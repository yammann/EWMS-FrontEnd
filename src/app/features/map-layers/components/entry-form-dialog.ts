import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Department } from '@core/models/ewms.models';
import { Alert } from '@shared/ui/alert';
import { errorMessage } from '@shared/ui/error-message';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { FieldValue, MapEntry, MapLayerDefinition, MapLayerField } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';

/** حدود الخادم (MapLayerRules) */
const TEXT_MAX = 500;
const LONG_TEXT_MAX = 4000;

/**
 * نموذج سجل طبقة على موقع، يُبنى من حقول الطبقة (نص، نص طويل، رقم، تاريخ، قائمة، نعم/لا).
 * الخادم يتحقق من القيم حسب النوع ويحفظ قسم من أدخله؛ من يملك نظرة المؤسسة أو سجلات الفرع كله يختار القسم.
 */
@Component({
  selector: 'app-entry-form-dialog', standalone: true,
  imports: [Modal, FormActions, Alert, SelectValue],
  templateUrl: './entry-form-dialog.html',
  styleUrls: ['../../../shared/styles/data-tools.scss', './entry-form-dialog.scss']
})
export class EntryFormDialog implements OnInit {
  private service = inject(MapLayersService);

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

  layer = computed(() => this.layers().find(l => l.id === this.layerId()) ?? null);
  fields = computed(() => (this.layer()?.fields ?? []).filter(f => !f.isHidden));
  unitOptions = computed(() => {
    const branchId = this.layer()?.branchId;
    return branchId ? this.departments().filter(d => d.branchId === branchId) : [];
  });

  /** سبب تعطيل الحفظ */
  problem = computed(() => {
    for (const f of this.fields()) {
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
    const values: Record<string, FieldValue> = {};
    for (const f of this.fields()) {
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
      next: saved => { this.saving.set(false); this.saved.emit(saved); },
      error: err => { this.saving.set(false); this.error.set(errorMessage(err, 'تعذر الحفظ')); }
    });
  }
}
