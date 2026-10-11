// طبقات خرائط الفروع (1.2.0) — تطابق Application/DTOs/Response/MapLayerResponseDtos.cs
// الطبقة ملك الفرع ويستعملها كل أقسامه؛ السجل معلومات الفرع عن موقع، يحمل قسم من أدخله.

/** 1 نص، 2 نص طويل، 3 رقم، 4 تاريخ، 5 قائمة اختيار، 6 نعم/لا */
export type MapFieldType = 1 | 2 | 3 | 4 | 5 | 6;

export const FIELD_TYPES: { value: MapFieldType; label: string }[] = [
  { value: 1, label: 'نص' },
  { value: 2, label: 'نص طويل' },
  { value: 3, label: 'رقم' },
  { value: 4, label: 'تاريخ' },
  { value: 5, label: 'قائمة اختيار' },
  { value: 6, label: 'نعم / لا' }
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
}

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
  /** {"<fieldId>": قيمة} */
  values: Record<string, FieldValue>;
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

export interface LayerFieldInput { id?: number | null; label: string; type: MapFieldType; isRequired: boolean; options: string[]; }
export interface LayerInput {
  branchId?: number | null; name: string; description: string; color: string; allowMultiple: boolean; isActive: boolean;
  fields: LayerFieldInput[]; rowVersion?: string | null;
}
export interface EntryInput {
  layerId: number; siteId: number; values: Record<string, FieldValue>; departmentId?: number | null; rowVersion?: string | null;
}

/** عرض قيمة حقل للقراءة */
export function formatFieldValue(field: MapLayerField, value: FieldValue | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 6) return value === true || value === 'true' ? 'نعم' : 'لا';
  if (field.type === 3 && typeof value === 'number') return value.toLocaleString('ar-SY');
  return String(value);
}
