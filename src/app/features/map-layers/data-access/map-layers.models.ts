// طبقات خرائط الفروع (1.2.0) — تطابق Application/DTOs/Response/MapLayerResponseDtos.cs
// الطبقة ملك الفرع ويستعملها كل أقسامه؛ السجل معلومات الفرع عن موقع، يحمل قسم من أدخله.

/** 1 نص، 2 نص طويل، 3 رقم، 4 تاريخ، 5 قائمة اختيار، 6 نعم/لا، 7 ملفات */
export type MapFieldType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const FIELD_TYPES: { value: MapFieldType; label: string }[] = [
  { value: 1, label: 'نص' },
  { value: 2, label: 'نص طويل' },
  { value: 3, label: 'رقم' },
  { value: 4, label: 'تاريخ' },
  { value: 5, label: 'قائمة اختيار' },
  { value: 6, label: 'نعم / لا' },
  { value: 7, label: 'ملفات' }
];

export const fieldTypeLabel = (t: number) => FIELD_TYPES.find(x => x.value === t)?.label ?? '';

/** ألوان مقترحة لنقاط الطبقات على الخريطة (يمكن اختيار أي لون) */
export const LAYER_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#4B5563'];

export interface MapLayerField {
  id: number;
  label: string;
  type: MapFieldType;
  isRequired: boolean;
  options: string[];
  sortOrder: number;
  /** مخفي: لا يظهر في النماذج والعرض، وقيمه محفوظة */
  isHidden: boolean;
  /** حقل الملفات (7): أقصى عدد ملفات، وأقصى حجم للملف بالـ MB، ومجموعات الصيغ المسموحة */
  maxFiles: number;
  maxFileMegabytes: number;
  fileKinds: string[];
}

/** ملف في حقل «ملفات» (معلّق حتى يُحفظ السجل بمعرّفه) */
export interface MapEntryFile {
  id: number;
  fieldId: number;
  fileName: string;
  contentType: string;
  kind: string;
  size: number;
  /** صورة أو PDF تُعاين داخل الصفحة؛ غيرها يُنزَّل */
  previewable: boolean;
  uploadedByName: string;
  uploadedAt: string;
}

export interface MapFileKind { key: string; label: string; formats: string; extensions: string[]; }

/** مصدر من بيانات النظام (GET MapLayers/Sources) بفلاتره من بيانات الفرع */
export interface MapSource { key: string; title: string; unit: string; filters: MapSourceFilter[]; }
export interface MapSourceFilter { key: string; label: string; options: { value: string; label: string }[]; }

/** سقف النظام لحجم الملف ومجموعات الصيغ (GET MapLayers/FileOptions) */
export interface MapFileOptions { maxFileMegabytes: number; maxFilesPerField: number; kinds: MapFileKind[]; }

export interface MapLayerDefinition {
  id: number;
  branchId: number;
  branchName: string;
  name: string;
  description: string;
  color: string;
  /** عدة سجلات للموقع الواحد أم سجل واحد */
  allowMultiple: boolean;
  isActive: boolean;
  sortOrder: number;
  /** فارغ = إدخال يدوي؛ وإلا مفتاح مزوّد من بيانات النظام (نقاطه من جداوله بلا إدخال) */
  source: string;
  sourceTitle: string;
  /** فلتر المزوّد: مفتاح ← قيم (المفتاح الغائب = الكل) */
  sourceFilter: Record<string, string[]>;
  entriesCount: number;
  fields: MapLayerField[];
  rowVersion: string;
}

/** قيمة حقل كما تُحفظ: نص، رقم، تاريخ yyyy-MM-dd، خيار، أو true/false */
export type FieldValue = string | number | boolean | null;

export interface MapEntry {
  id: number;
  layerId: number;
  layerName: string;
  layerColor: string;
  siteId: number;
  siteName: string;
  branchId: number;
  branchName: string;
  departmentId: number | null;
  departmentName: string;
  /** {"<fieldId>": قيمة} — حقول الملفات ليست هنا، بل في files */
  values: Record<string, FieldValue>;
  /** ملفات حقول «ملفات» (كل ملف يحمل fieldId) */
  files: MapEntryFile[];
  createdByName: string;
  createdAt: string;
  updatedByName: string;
  updatedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  rowVersion: string;
}

export interface SiteEntries {
  /** طبقات فرعي الفعّالة (أو كل الفروع لنظرة المؤسسة) بحقولها الظاهرة، وطبقات السجلات المعروضة وإن كانت معطّلة (isActive=false: للقراءة) */
  layers: MapLayerDefinition[];
  entries: MapEntry[];
  canCreate: boolean;
}

export interface LayerFieldInput {
  id?: number | null; label: string; type: MapFieldType; isRequired: boolean; options: string[];
  maxFiles: number; maxFileMegabytes: number; fileKinds: string[];
}
export interface LayerInput {
  branchId?: number | null; name: string; description: string; color: string; allowMultiple: boolean; isActive: boolean;
  /** فارغ = يدوي؛ لا يتغير بعد الإنشاء */
  source: string; sourceFilter: Record<string, string[]>;
  fields: LayerFieldInput[]; rowVersion?: string | null;
}
export interface EntryInput {
  /** حقل الملفات: مصفوفة معرّفات ملفاته = قائمته الكاملة بعد الحفظ */
  layerId: number; siteId: number; values: Record<string, FieldValue | number[]>; departmentId?: number | null; rowVersion?: string | null;
}

/** امتدادات الصيغ المسموحة في حقل (لخانة اختيار الملف وللفحص قبل الرفع) */
export function fieldExtensions(field: MapLayerField, options: MapFileOptions | null): string[] {
  return [...new Set((options?.kinds ?? []).filter(k => field.fileKinds.includes(k.key)).flatMap(k => k.extensions))];
}

/** أقصى حجم للملف في الحقل بالـ MB (لا يتجاوز سقف النظام) */
export function fieldMaxMegabytes(field: MapLayerField, options: MapFileOptions | null): number {
  const cap = options?.maxFileMegabytes ?? field.maxFileMegabytes;
  return Math.min(field.maxFileMegabytes || cap, cap);
}

/** فحص سريع قبل الرفع (الخادم يكشف النوع الفعلي من المحتوى) — رسالة أو null */
export function fileProblem(file: File, field: MapLayerField, options: MapFileOptions | null): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  const allowed = fieldExtensions(field, options);
  if (allowed.length && !allowed.includes(ext)) return `«${file.name}»: الحقل «${field.label}» يقبل ${allowed.join(' ')}`;
  const maxMb = fieldMaxMegabytes(field, options);
  if (file.size > maxMb * 1024 * 1024) return `«${file.name}» أكبر من ${maxMb}MB`;
  if (file.size === 0) return `«${file.name}» فارغ`;
  return null;
}

/** عرض قيمة حقل للقراءة */
export function formatFieldValue(field: MapLayerField, value: FieldValue | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 6) return value === true || value === 'true' ? 'نعم' : 'لا';
  if (field.type === 3 && typeof value === 'number') return value.toLocaleString('ar-SY');
  return String(value);
}
