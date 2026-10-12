import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Branch } from '@core/models/ewms.models';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { errorMessage } from '@shared/ui/error-message';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { FIELD_TYPES, LAYER_COLORS, LayerInput, MapFieldType, MapFileOptions, MapLayerDefinition, MapSource } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';

/** حدود الخادم (MapLayerRules) */
const MAX_FIELDS = 40;

/** صف في منشئ الحقول (id = null لحقل لم يُحفظ بعد) */
interface FieldRow {
  key: number;
  id: number | null;
  label: string;
  type: MapFieldType;
  isRequired: boolean;
  /** خيارات القائمة: خيار في كل سطر */
  options: string;
  isHidden: boolean;
  /** حقل الملفات: مجموعات الصيغ، وأقصى عدد، وأقصى حجم للملف بالـ MB */
  fileKinds: string[];
  maxFiles: number;
  maxFileMegabytes: number;
}

/** إعدادات حقل ملفات جديد (يعدّلها مدير الطبقة) */
const DEFAULT_MAX_FILES = 5;
const DEFAULT_FILE_MB = 25;

let keySeq = 0;

/**
 * نافذة إنشاء/تعديل طبقة: الاسم واللون والإعدادات، ومنشئ الحقول (عنوان، نوع، مطلوب، خيارات القائمة، ترتيب).
 * حذف حقل محفوظ يُنفَّذ فوراً على الخادم: بلا قيم يُحذف، وله قيم يُسأل المستخدم «إخفاء» (تبقى القيم ويمكن إعادته)
 * أو «حذف نهائي» (تُمحى قيمه من كل السجلات). الحفظ نفسه بيد الصفحة (CrudPage) عبر submitted.
 */
@Component({
  selector: 'app-layer-form-dialog', standalone: true,
  imports: [Modal, FormActions, Alert, ReactiveFormsModule, SelectValue],
  templateUrl: './layer-form-dialog.html',
  styleUrls: ['../../../shared/styles/data-tools.scss', './layer-form-dialog.scss']
})
export class LayerFormDialog implements OnInit {
  private service = inject(MapLayersService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  /** null = طبقة جديدة */
  layer = input<MapLayerDefinition | null>(null);
  /** غير فارغة = يختار فرع الطبقة الجديدة (نظرة المؤسسة) */
  branches = input<Branch[]>([]);
  defaultBranchId = input<number | null>(null);
  busy = input(false);
  error = input('');

  submitted = output<LayerInput>();
  closed = output<void>();
  /** تغيّر على الخادم من داخل النافذة (حذف/إخفاء/إعادة حقل): تعيد الصفحة قراءة القائمة */
  changed = output<MapLayerDefinition>();

  types = FIELD_TYPES;
  colors = LAYER_COLORS;
  /** سقف النظام لحجم الملف ومجموعات الصيغ (لحقول الملفات) */
  fileOptions = signal<MapFileOptions | null>(null);

  /** مصادر بيانات النظام المتاحة لفرع الطبقة، والمصدر المختار ('' = إدخال يدوي) وفلتره */
  sources = signal<MapSource[]>([]);
  sourcesLoading = signal(false);
  source = signal('');
  filter = signal<Record<string, string[]>>({});
  isSystem = computed(() => this.source() !== '');
  selectedSource = computed(() => this.sources().find(s => s.key === this.source()) ?? null);

  form = inject(FormBuilder).nonNullable.group({
    branchId: [''],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    color: [LAYER_COLORS[0], Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    allowMultiple: [true],
    isActive: [true]
  });

  rows = signal<FieldRow[]>([]);
  visibleRows = computed(() => this.rows().filter(r => !r.isHidden));
  hiddenRows = computed(() => this.rows().filter(r => r.isHidden));
  /** حقل يُنفَّذ عليه حذف/إعادة على الخادم */
  workingKey = signal<number | null>(null);
  /** حقل له قيم: اختيار الإخفاء أو الحذف النهائي */
  choice = signal<{ row: FieldRow; count: number } | null>(null);
  deciding = signal(false);

  /** سبب تعطيل الحفظ في الحقول (يظهر تحت المنشئ) */
  fieldsError = computed(() => {
    if (this.isSystem()) return '';
    const visible = this.visibleRows();
    if (visible.some(r => !r.label.trim())) return 'اكتب عنوان كل حقل';
    if (visible.some(r => r.label.trim().length > 100)) return 'عنوان الحقل لا يتجاوز 100 حرف';
    const labels = visible.map(r => r.label.trim());
    if (new Set(labels).size !== labels.length) return 'عناوين الحقول متكررة';
    if (visible.some(r => r.type === 5 && !this.optionList(r.options).length)) return 'حقل القائمة يحتاج خياراً واحداً على الأقل';
    const files = visible.filter(r => r.type === 7);
    if (files.some(r => !r.fileKinds.length)) return 'اختر صيغة واحدة على الأقل لكل حقل ملفات';
    const maxFiles = this.fileOptions()?.maxFilesPerField ?? 20;
    if (files.some(r => !Number.isInteger(r.maxFiles) || r.maxFiles < 1 || r.maxFiles > maxFiles)) return `عدد ملفات الحقل من 1 إلى ${maxFiles}`;
    const cap = this.fileOptions()?.maxFileMegabytes;
    if (files.some(r => !Number.isInteger(r.maxFileMegabytes) || r.maxFileMegabytes < 1)) return 'حدّد أقصى حجم للملف بالـ MB';
    if (cap && files.some(r => r.maxFileMegabytes > cap)) return `حجم الملف لا يتجاوز سقف النظام ${cap}MB`;
    return '';
  });

  get isEdit() { return !!this.layer(); }

  ngOnInit() {
    const l = this.layer();
    this.form.reset({
      branchId: this.defaultBranchId() ? String(this.defaultBranchId()) : '',
      name: l?.name ?? '',
      description: l?.description ?? '',
      color: l?.color || LAYER_COLORS[0],
      allowMultiple: l?.allowMultiple ?? true,
      isActive: l?.isActive ?? true
    });
    if (this.branches().length && !l) this.form.controls.branchId.addValidators(Validators.required);
    this.form.controls.branchId.updateValueAndValidity();
    this.rows.set((l?.fields ?? []).map(f => ({
      key: ++keySeq, id: f.id, label: f.label, type: f.type, isRequired: f.isRequired, options: f.options.join('\n'), isHidden: f.isHidden,
      fileKinds: [...(f.fileKinds ?? [])], maxFiles: f.maxFiles || DEFAULT_MAX_FILES, maxFileMegabytes: f.maxFileMegabytes || DEFAULT_FILE_MB
    })));
    if (!l) this.addField();
    this.service.fileOptions().subscribe({ next: o => this.fileOptions.set(o), error: () => this.fileOptions.set(null) });

    this.source.set(l?.source ?? '');
    this.filter.set(structuredClone(l?.sourceFilter ?? {}));
    // مصادر فرع الطبقة: فرعها عند التعديل، والمختار في النموذج عند الإنشاء (نظرة المؤسسة)، وإلا فرعي
    this.loadSources(l ? l.branchId : this.chosenBranch());
    if (!l) this.form.controls.branchId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.filter.set({});
      this.loadSources(this.chosenBranch());
    });
  }

  private chosenBranch() { const v = this.form.controls.branchId.value; return v ? Number(v) : null; }

  private loadSources(branchId: number | null) {
    // من يختار الفرع: لا مصادر قبل اختياره
    if (this.branches().length && !branchId && !this.layer()) { this.sources.set([]); return; }
    this.sourcesLoading.set(true);
    this.service.sources(branchId).subscribe({
      next: list => { this.sources.set(list); this.sourcesLoading.set(false); },
      error: () => { this.sources.set([]); this.sourcesLoading.set(false); }
    });
  }

  chooseSource(key: string) {
    this.source.set(key);
    this.filter.set({});
  }

  isPicked(filterKey: string, value: string) { return (this.filter()[filterKey] ?? []).includes(value); }

  togglePick(filterKey: string, value: string, on: boolean) {
    this.filter.update(all => {
      const values = new Set(all[filterKey] ?? []);
      if (on) values.add(value); else values.delete(value);
      const next = { ...all, [filterKey]: [...values] };
      if (!next[filterKey].length) delete next[filterKey];
      return next;
    });
  }

  optionList(text: string) {
    return [...new Set(text.split('\n').map(o => o.trim()).filter(Boolean))];
  }

  addField() {
    if (this.rows().length >= MAX_FIELDS) { this.toast.error(`الحد الأقصى ${MAX_FIELDS} حقلاً للطبقة`); return; }
    this.rows.update(list => [...list, {
      key: ++keySeq, id: null, label: '', type: 1, isRequired: false, options: '', isHidden: false,
      fileKinds: [], maxFiles: DEFAULT_MAX_FILES, maxFileMegabytes: this.defaultMegabytes()
    }]);
  }

  setType(key: number, value: string) { this.patch(key, { type: Number(value) as MapFieldType }); }

  /** حجم افتراضي لحقل ملفات جديد: 25MB أو سقف النظام إن كان أقل */
  private defaultMegabytes() { return Math.min(DEFAULT_FILE_MB, this.fileOptions()?.maxFileMegabytes ?? DEFAULT_FILE_MB); }

  toggleKind(key: number, kind: string, on: boolean) {
    this.rows.update(list => list.map(r => r.key !== key ? r
      : { ...r, fileKinds: on ? [...new Set([...r.fileKinds, kind])] : r.fileKinds.filter(k => k !== kind) }));
  }

  patch(key: number, change: Partial<FieldRow>) {
    this.rows.update(list => list.map(r => r.key === key ? { ...r, ...change } : r));
  }

  /** نقل حقل ظاهر للأعلى/للأسفل بين الحقول الظاهرة */
  move(key: number, step: -1 | 1) {
    const visible = this.visibleRows();
    const i = visible.findIndex(r => r.key === key);
    const j = i + step;
    if (i < 0 || j < 0 || j >= visible.length) return;
    const order = visible.map(r => r.key);
    [order[i], order[j]] = [order[j], order[i]];
    this.rows.update(list => [...order.map(k => list.find(r => r.key === k)!), ...list.filter(r => r.isHidden)]);
  }

  async removeField(row: FieldRow) {
    if (row.id == null) { this.rows.update(list => list.filter(r => r.key !== row.key)); return; }
    if (this.workingKey() !== null) return;
    this.workingKey.set(row.key);
    try {
      const usage = await firstValueFrom(this.service.fieldUsage(row.id));
      if (usage.count > 0) { this.choice.set({ row, count: usage.count }); return; }
      if (await this.confirm.ask(`حذف الحقل «${row.label}»؟ لا توجد له قيم مسجّلة.`, 'حذف')) await this.applyDelete(row, false);
    } catch (e) {
      this.toast.error(errorMessage(e, 'تعذر حذف الحقل'));
    } finally {
      if (!this.choice()) this.workingKey.set(null);
    }
  }

  /** من نافذة الاختيار: purge=false إخفاء، purge=true حذف نهائي مع القيم */
  async decide(purge: boolean) {
    const c = this.choice();
    if (!c || this.deciding()) return;
    this.deciding.set(true);
    try {
      await this.applyDelete(c.row, purge);
      this.choice.set(null);
    } catch (e) {
      this.toast.error(errorMessage(e, 'تعذر حذف الحقل'));
    } finally {
      this.deciding.set(false);
      this.workingKey.set(null);
    }
  }

  cancelChoice() {
    if (this.deciding()) return;
    this.choice.set(null);
    this.workingKey.set(null);
  }

  private async applyDelete(row: FieldRow, purge: boolean) {
    const layer = await firstValueFrom(this.service.deleteField(row.id!, purge));
    const saved = layer.fields.find(f => f.id === row.id);
    if (saved?.isHidden) {
      this.patch(row.key, { isHidden: true });
      this.toast.success(`أُخفي الحقل «${row.label}» — قيمه محفوظة ويمكن إعادته`);
    } else {
      this.rows.update(list => list.filter(r => r.key !== row.key));
      this.toast.success(`حُذف الحقل «${row.label}»`);
    }
    this.changed.emit(layer);
  }

  async restore(row: FieldRow) {
    if (row.id == null || this.workingKey() !== null) return;
    this.workingKey.set(row.key);
    try {
      const layer = await firstValueFrom(this.service.restoreField(row.id));
      // يعود في آخر الحقول الظاهرة
      this.rows.update(list => [...list.filter(r => !r.isHidden), { ...row, isHidden: false }, ...list.filter(r => r.isHidden && r.key !== row.key)]);
      this.toast.success(`أُعيد الحقل «${row.label}»`);
      this.changed.emit(layer);
    } catch (e) {
      this.toast.error(errorMessage(e, 'تعذر إعادة الحقل'));
    } finally {
      this.workingKey.set(null);
    }
  }

  save() {
    if (this.form.invalid || this.fieldsError()) return;
    const v = this.form.getRawValue();
    // الحقول الظاهرة بترتيبها ثم المخفية (ترتيب ثابت للخادم)
    const ordered = [...this.visibleRows(), ...this.hiddenRows()];
    this.submitted.emit({
      branchId: v.branchId ? Number(v.branchId) : null,
      name: v.name.trim(),
      description: v.description.trim(),
      color: v.color.toUpperCase(),
      allowMultiple: !this.isSystem() && v.allowMultiple,
      isActive: v.isActive,
      source: this.source(),
      sourceFilter: this.isSystem() ? this.filter() : {},
      // طبقة بيانات النظام بلا حقول — نقاطها من جداوله
      fields: this.isSystem() ? [] : ordered.map(r => ({
        id: r.id, label: r.label.trim(), type: r.type, isRequired: r.isRequired,
        options: r.type === 5 ? this.optionList(r.options) : [],
        maxFiles: r.type === 7 ? r.maxFiles : 0,
        maxFileMegabytes: r.type === 7 ? r.maxFileMegabytes : 0,
        fileKinds: r.type === 7 ? r.fileKinds : []
      }))
    });
  }
}
