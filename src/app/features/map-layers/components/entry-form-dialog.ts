import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Department } from '@core/models/ewms.models';
import { fileSize } from '@core/utils/file-size';
import { Alert } from '@shared/ui/alert';
import { errorMessage } from '@shared/ui/error-message';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import {
  FieldValue, MapEntry, MapEntryFile, MapFileOptions, MapLayerDefinition, MapLayerField, fieldExtensions, fieldMaxMegabytes, fileProblem
} from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';
import { kindIcon } from './entry-files';
import { Icon } from '@shared/ui/icon';

/** حدود الخادم (MapLayerRules) */
const TEXT_MAX = 500;
const LONG_TEXT_MAX = 4000;

/** ملف قيد الرفع */
interface Upload { key: number; fieldId: number; name: string; percent: number; }

/**
 * نموذج سجل طبقة على موقع، يُبنى من حقول الطبقة (نص، نص طويل، رقم، تاريخ، قائمة، نعم/لا، ملفات).
 * الخادم يتحقق من القيم حسب النوع ويحفظ قسم من أدخله؛ من يملك نظرة المؤسسة أو سجلات الفرع كله يختار القسم.
 * حقل الملفات: كل ملف يُرفع وحده (بشريط تقدّم) ويبقى معلّقاً حتى «حفظ»؛ الإلغاء يحذف ما رُفع في هذه النافذة.
 */
@Component({
  selector: 'app-entry-form-dialog', standalone: true,
  imports: [Icon, Modal, FormActions, Alert, SelectValue],
  templateUrl: './entry-form-dialog.html',
  styleUrls: ['../../../shared/styles/data-tools.scss', './entry-form-dialog.scss']
})
export class EntryFormDialog implements OnInit {
  private service = inject(MapLayersService);
  private destroyRef = inject(DestroyRef);

  siteId = input.required<number>();
  siteName = input('');
  /** الطبقات المتاحة (للإضافة: الفعّالة التي تقبل سجلاً جديداً على هذا الموقع؛ للتعديل: طبقة السجل) */
  layers = input.required<MapLayerDefinition[]>();
  /** null = سجل جديد */
  entry = input<MapEntry | null>(null);
  /** غير فارغة = يختار القسم المالك (تُصفّى على فرع الطبقة) */
  departments = input<Department[]>([]);

  saved = output<MapEntry>();
  closed = output<void>();

  layerId = signal(0);
  values = signal<Record<string, FieldValue>>({});
  departmentId = signal('');
  saving = signal(false);
  error = signal('');

  fileOptions = signal<MapFileOptions | null>(null);
  /** ملفات كل حقل ملفات كما ستُحفظ: الموجودة في السجل + ما رُفع الآن */
  files = signal<Record<number, MapEntryFile[]>>({});
  uploads = signal<Upload[]>([]);
  fileErrors = signal<Record<number, string>>({});
  dragOver = signal<number | null>(null);
  size = fileSize;
  icon = kindIcon;
  /** ملفات رفعتُها في هذه النافذة ولم تُحفظ بعد — تُحذف عند الإلغاء */
  private pendingIds = new Set<number>();
  private active = new Set<Subscription>();
  private queue: Promise<void> = Promise.resolve();
  private uploadSeq = 0;
  private destroyed = false;

  layer = computed(() => this.layers().find(l => l.id === this.layerId()) ?? null);
  fields = computed(() => (this.layer()?.fields ?? []).filter(f => !f.isHidden));
  unitOptions = computed(() => {
    const branchId = this.layer()?.branchId;
    return branchId ? this.departments().filter(d => d.branchId === branchId) : [];
  });

  /** سبب تعطيل الحفظ */
  problem = computed(() => {
    if (this.uploads().length) return 'انتظر انتهاء رفع الملفات';
    for (const f of this.fields()) {
      if (f.type === 7) {
        if (f.isRequired && !(this.files()[f.id]?.length)) return `الحقل «${f.label}» مطلوب — أرفق ملفاً واحداً على الأقل`;
        continue;
      }
      const v = this.values()[f.id];
      const empty = v === null || v === undefined || v === '';
      if (f.isRequired && empty) return `الحقل «${f.label}» مطلوب`;
      if (typeof v === 'string' && f.type === 1 && v.length > TEXT_MAX) return `«${f.label}» لا يتجاوز ${TEXT_MAX} حرف`;
      if (typeof v === 'string' && f.type === 2 && v.length > LONG_TEXT_MAX) return `«${f.label}» لا يتجاوز ${LONG_TEXT_MAX} حرف`;
      if (f.type === 3 && typeof v === 'number' && !Number.isFinite(v)) return `«${f.label}» يقبل رقماً فقط`;
    }
    return this.layer() ? '' : 'اختر الطبقة';
  });

  get isEdit() { return !!this.entry(); }

  ngOnInit() {
    const e = this.entry();
    this.layerId.set(e?.layerId ?? this.layers()[0]?.id ?? 0);
    this.values.set({ ...(e?.values ?? {}) });
    this.departmentId.set(e?.departmentId ? String(e.departmentId) : '');
    const byField: Record<number, MapEntryFile[]> = {};
    for (const file of e?.files ?? []) (byField[file.fieldId] ??= []).push(file);
    this.files.set(byField);
    if (this.layers().some(l => l.fields.some(f => f.type === 7))) {
      this.service.fileOptions().subscribe({ next: o => this.fileOptions.set(o), error: () => this.fileOptions.set(null) });
    }
    this.destroyRef.onDestroy(() => { this.destroyed = true; this.active.forEach(s => s.unsubscribe()); });
  }

  // ─────────── حقل الملفات ───────────
  accept(f: MapLayerField) { return fieldExtensions(f, this.fileOptions()).join(','); }
  maxMb(f: MapLayerField) { return fieldMaxMegabytes(f, this.fileOptions()); }
  formats(f: MapLayerField) {
    return (this.fileOptions()?.kinds ?? []).filter(k => f.fileKinds.includes(k.key)).map(k => `${k.label} (${k.formats})`).join(' · ');
  }
  uploadsOf(fieldId: number) { return this.uploads().filter(u => u.fieldId === fieldId); }
  remaining(f: MapLayerField) { return f.maxFiles - (this.files()[f.id]?.length ?? 0) - this.uploadsOf(f.id).length; }

  picked(f: MapLayerField, input: HTMLInputElement) {
    this.take(f, [...(input.files ?? [])]);
    input.value = '';
  }

  dropped(f: MapLayerField, event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(null);
    this.take(f, [...(event.dataTransfer?.files ?? [])]);
  }

  private take(f: MapLayerField, list: File[]) {
    this.setFileError(f.id, '');
    if (!list.length) return;
    const left = this.remaining(f);
    if (list.length > left) { this.setFileError(f.id, `الحقل «${f.label}» يقبل ${f.maxFiles} ملفات — المتبقي ${Math.max(0, left)}`); return; }
    const bad = list.map(file => fileProblem(file, f, this.fileOptions())).find(p => p);
    if (bad) { this.setFileError(f.id, bad); return; }
    for (const file of list) {
      const key = ++this.uploadSeq;
      this.uploads.update(all => [...all, { key, fieldId: f.id, name: file.name, percent: 0 }]);
      // ملف بعد ملف: لا يُثقل الخادم ولا الشبكة برفع متوازٍ لملفات كبيرة
      this.queue = this.queue.then(() => this.uploadOne(f, file, key));
    }
  }

  private uploadOne(f: MapLayerField, file: File, key: number): Promise<void> {
    return new Promise(resolve => {
      if (this.destroyed) { resolve(); return; }
      const done = () => { this.uploads.update(all => all.filter(u => u.key !== key)); this.active.delete(sub); resolve(); };
      const sub: Subscription = this.service.uploadFile(f.id, file).subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const percent = Math.round((100 * event.loaded) / event.total);
            this.uploads.update(all => all.map(u => u.key === key ? { ...u, percent } : u));
          } else if (event.type === HttpEventType.Response && event.body) {
            const saved = event.body;
            this.pendingIds.add(saved.id);
            this.files.update(all => ({ ...all, [f.id]: [...(all[f.id] ?? []), saved] }));
          }
        },
        error: e => { this.setFileError(f.id, errorMessage(e, `تعذر رفع «${file.name}»`)); done(); },
        complete: done
      });
      this.active.add(sub);
    });
  }

  /** إزالة من النموذج: المرفوع الآن يُحذف من الخادم فوراً، والموجود يُحذف عند «حفظ» */
  removeFile(f: MapLayerField, file: MapEntryFile) {
    this.files.update(all => ({ ...all, [f.id]: (all[f.id] ?? []).filter(x => x.id !== file.id) }));
    if (this.pendingIds.delete(file.id)) this.service.deletePendingFile(file.id).subscribe({ error: () => undefined });
  }

  private setFileError(fieldId: number, message: string) {
    this.fileErrors.update(all => ({ ...all, [fieldId]: message }));
  }

  /** إغلاق بلا حفظ: يُلغى الرفع الجاري ويُحذف ما رُفع في هذه النافذة (وما يفلت تحذفه خدمة الخلفية بعد 24 ساعة) */
  cancel() {
    if (this.saving()) return;
    this.active.forEach(s => s.unsubscribe());
    for (const id of this.pendingIds) this.service.deletePendingFile(id).subscribe({ error: () => undefined });
    this.pendingIds.clear();
    this.closed.emit();
  }

  value(f: MapLayerField): FieldValue { return this.values()[f.id] ?? null; }

  set(f: MapLayerField, v: FieldValue) {
    this.values.update(all => ({ ...all, [f.id]: v }));
  }

  setNumber(f: MapLayerField, text: string) { this.set(f, text.trim() === '' ? null : Number(text)); }
  setYesNo(f: MapLayerField, text: string) { this.set(f, text === 'true' ? true : text === 'false' ? false : null); }
  yesNo(f: MapLayerField) { const v = this.value(f); return v === true || v === 'true' ? 'true' : v === false || v === 'false' ? 'false' : ''; }
  text(f: MapLayerField) { const v = this.value(f); return v === null ? '' : String(v); }

  /** قيمة قديمة لم تعد في خيارات القائمة: تُعرض ليعرفها المستخدم ويختار غيرها */
  staleOption(f: MapLayerField) {
    const v = this.value(f);
    return typeof v === 'string' && v && !f.options.includes(v) ? v : null;
  }

  save() {
    const layer = this.layer();
    if (!layer || this.problem() || this.saving()) return;
    // حقول الطبقة الظاهرة فقط (المخفية يبقيها الخادم كما هي)
    const values: Record<string, FieldValue | number[]> = {};
    for (const f of this.fields()) {
      // حقل الملفات: قائمة معرّفات ملفاته الكاملة بعد الحفظ
      if (f.type === 7) { values[f.id] = (this.files()[f.id] ?? []).map(x => x.id); continue; }
      const v = this.values()[f.id];
      values[f.id] = typeof v === 'string' ? v.trim() || null : v ?? null;
    }
    const e = this.entry();
    const body = {
      layerId: layer.id, siteId: this.siteId(), values,
      departmentId: this.unitOptions().length && this.departmentId() ? Number(this.departmentId()) : null,
      rowVersion: e?.rowVersion ?? null
    };
    this.saving.set(true); this.error.set('');
    (e ? this.service.updateEntry(e.id, body) : this.service.createEntry(body)).subscribe({
      next: saved => { this.saving.set(false); this.pendingIds.clear(); this.saved.emit(saved); },
      error: err => { this.saving.set(false); this.error.set(errorMessage(err, 'تعذر الحفظ')); }
    });
  }
}
