/** جدول مساعد (نوع جهاز / شركة / نوع عطل / حالة طلب) — الحقول الاختيارية حسب الجدول */
export interface MaintenanceLookup {
  id: number;
  name: string;
  description?: string;
  color?: string;
  /** حالات الطلب فقط: المرحلة الثابتة التي تحدد سلوك الحالة (انظر MAINTENANCE_STAGES) */
  stage?: MaintenanceStage;
  /** أنواع الأجهزة فقط: حد «إصلاحه أغلى من استبداله» لتكلفة قطع الجهاز على مدى عمره (ل.س) */
}

/** مراحل ثابتة يفهمها النظام — الحالات أسماء وألوان، والمرحلة تحدد السلوك */
export type MaintenanceStage = 1 | 2 | 3 | 4 | 5;

export const MAINTENANCE_STAGES: { value: MaintenanceStage; label: string; hint: string }[] = [
  { value: 1, label: 'جديد', hint: 'استُلم ولم يبدأ العمل' },
  { value: 2, label: 'قيد العمل', hint: 'يُسجَّل وقت البدء تلقائياً' },
  { value: 3, label: 'جاهز للتسليم', hint: 'يُسجَّل وقت الإنجاز ويُبلَّغ العميل' },
  { value: 4, label: 'مُسلَّم', hint: 'نهائية — يُقفل الطلب ويُثبَّت توقيع ورقة التسليم' },
  { value: 5, label: 'غير قابل للصيانة', hint: 'نهائية — يُقفل الطلب' }
];

export function stageLabel(stage: number | null | undefined): string {
  return MAINTENANCE_STAGES.find(s => s.value === stage)?.label ?? '—';
}

/** «مُسلَّم» و«غير قابل للصيانة»: الطلب يُقفل بعدها (لا تعديل ولا تغيير حالة ولا نقل) */
export function isFinalStage(stage: number | null | undefined): boolean {
  return stage === 4 || stage === 5;
}

/** نص التأكيد قبل تحويل طلب إلى حالة نهائية */
export function finalStageConfirm(number: string, statusName: string): string {
  return `تحويل الطلب ${number} إلى «${statusName}» سيُقفله نهائياً: لا تعديل ولا تغيير حالة بعدها، وإن عاد الجهاز يُسجَّل طلب جديد. متابعة؟`;
}

export type MaintenanceStatus = MaintenanceLookup & { color: string; stage: MaintenanceStage };

export interface MaintenanceRequest {
  id: number;
  /** الرقم المعروض: MR-2026-00125 */
  number: string;
  /** ما يستطيعه المستخدم الحالي على هذا الطلب (النطاق — الصلاحية تُفحص منفصلة) */
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  /** الطلب مسند إليّ وأملك طلب التحويل */
  canRequestTransfer: boolean;

  userId: number;
  technicianName: string;
  departmentId: number | null;
  departmentName: string;

  /** العميل موظف (رقمه وقسمه الحالي) أو من خارج المؤسسة (null) */
  clientUserId: number | null;
  clientDepartmentName: string;
  clientName: string;
  clientPhone: string;

  /** الجهاز (سجل أجهزة الصيانة) — النوع والشركة والموديل والرقم التسلسلي تأتي منه */
  deviceMaintenanceId: number;
  deviceName: string;
  deviceTypeId: number;
  deviceTypeName: string;
  damageTypeId: number;
  damageTypeName: string;
  deviceCompanyId: number;
  deviceCompanyName: string;

  model: string;
  accessories: string;
  serialNumber: string;
  description: string;

  maintenanceRequestStatusId: number;
  statusName: string;
  statusColor: string;
  /** مرحلة الحالة الحالية */
  statusStage: MaintenanceStage;
  /** مُسلَّم أو غير قابل للصيانة — للقراءة فقط */
  isClosed: boolean;

  createdAt: string;
  updatedAt: string;
  /** يسجّلهما الخادم تلقائياً بحسب المرحلة (لا يُدخلان يدوياً) */
  startedAt: string | null;
  completedAt: string | null;
}

export interface MaintenanceRequestInput {
  /** عميل موظف (من ClientLookup) أو null لعميل من خارج المؤسسة */
  clientUserId: number | null;
  clientName: string;
  clientPhone: string;
  /** جهاز مسجّل في أجهزة الصيانة (يُضاف أولاً إن كان جديداً) */
  deviceMaintenanceId: number;
  /** الفني المسؤول عند الإنشاء (لمن يملك الإسناد؛ null = من يسجّل الطلب) */
  assigneeId?: number | null;
  damageTypeId: number;
  accessories: string;
  description: string;
  maintenanceRequestStatusId: number;
}

export interface MaintenanceRequestFilter {
  /** كل طلبات جهاز واحد (سجل إصلاحاته) */
  deviceMaintenanceId?: number | null;
  serialNumber?: string;
  model?: string;
  clientName?: string;
  deviceCompanyId?: number | null;
  technicianId?: number | null;
  deviceTypeId?: number | null;
  damageTypeId?: number | null;
  statusId?: number | null;
  page?: number;
  pageSize?: number;
}

export interface MaintenanceTask {
  id: number;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;

  userId: number;
  userName: string;
  departmentId: number | null;
  departmentName: string;

  taskLocation: string;
  requestingParty: string;
  requiredWork: string;
  completedWorks: string;

  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MaintenanceTaskInput {
  /** الموظف الموجَّهة إليه المهمة (عند الإنشاء) — null = لي */
  assigneeId?: number | null;
  taskLocation: string;
  requestingParty: string;
  requiredWork: string;
  completedWorks: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** عميل موظف وجده البحث (مطابقة تامة للاسم الكامل أو الرقم الذاتي) */
export interface MaintenanceClient { id: number; fullName: string; departmentName: string; phone: string | null; }

/** طلب صيانة كما يراه العميل الموظف («أجهزتي في الصيانة») */
export interface MyMaintenanceRequest {
  id: number; number: string;
  deviceName: string; deviceTypeName: string; deviceCompanyName: string; model: string; serialNumber: string;
  damageTypeName: string; statusName: string; statusColor: string; technicianName: string;
  createdAt: string; completedAt: string | null; deliveredAt: string | null;
}

/** طلب تحويل طلب صيانة إلى موظف آخر — status: 1 بانتظار القرار، 2 قُبل، 3 رُفض، 4 أُغلق (نُقل مباشرة) */
export interface MaintenanceTransfer {
  id: number;
  maintenanceRequestId: number;
  requestNumber: string;
  clientName: string;
  requestedById: number;
  requestedByName: string;
  suggestedUserId: number | null;
  suggestedUserName: string | null;
  reason: string;
  status: number;
  statusAr: string;
  decidedByName: string | null;
  newUserName: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** جهاز صيانة: قطعة فعلية برقم تسلسلي فريد، تتجمّع تحته طلبات صيانتها */
export interface MaintenanceDevice {
  id: number;
  name: string;
  serialNumber: string;
  model: string;
  description: string;
  deviceTypeId: number;
  deviceTypeName: string;
  deviceCompanyId: number;
  deviceCompanyName: string;
}

export interface MaintenanceDeviceInput {
  name: string;
  serialNumber: string;
  model: string;
  description: string;
  deviceTypeId: number;
  deviceCompanyId: number;
}

/** بحث الأجهزة: serialNumber/model «يبدأ بـ»، name «يحتوي» */
export interface MaintenanceDeviceFilter {
  serialNumber?: string;
  model?: string;
  name?: string;
  deviceTypeId?: number | null;
  deviceCompanyId?: number | null;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TechnicianOption { id: number; fullName: string; }

/** 1 تسجيل، 2 تغيير حالة، 3 نقل لفني آخر، 4 تعديل، 5 طلب تحويل، 6 رفض التحويل، 7 صرف قطعة، 8 إعادة قطعة للمخزون */
export interface MaintenanceActivity {
  id: number;
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  text: string;
  userId: number;
  userName: string;
  createdAt: string;
}

export interface MaintenancePrint {
  request: MaintenanceRequest;
  /** بعد التسليم: الموقّع كما ثُبِّت لحظة التسليم؛ قبله: الموقّع المتوقع */
  managerName: string;
  /** التوقيع المثبَّت لحظة التسليم (null قبل التسليم، أو إن لم يكن للموقّع توقيع وقتها) */
  managerSignature: string | null;
  delivered: boolean;
  deliveredAt: string | null;
}

export interface MaintenanceCount { id: number; name: string; color: string | null; count: number; }

export interface MaintenanceStats {
  totalRequests: number;
  requestsThisMonth: number;
  totalTasks: number;
  tasksThisMonth: number;
  averageRepairHours: number | null;
  byStatus: MaintenanceCount[];
  byTechnician: MaintenanceCount[];
  byDamageType: MaintenanceCount[];
  byDeviceType: MaintenanceCount[];
  byCompany: MaintenanceCount[];
  tasksByUser: MaintenanceCount[];
  monthly: { year: number; month: number; count: number }[];
}

/** الجداول المساعدة الأربعة: المسار في الـ API وما تحتويه من حقول */
export const MAINTENANCE_LOOKUPS = {
  deviceTypes: { api: '/DeviceTypes', label: 'أنواع الأجهزة', single: 'نوع جهاز', description: false, color: false },
  companies: { api: '/DeviceCompanies', label: 'الشركات المصنّعة', single: 'شركة مصنّعة', description: true, color: false },
  damageTypes: { api: '/DamageTypes', label: 'أنواع الأعطال', single: 'نوع عطل', description: true, color: false },
  statuses: { api: '/MaintenanceRequestStatuses', label: 'حالات الطلب', single: 'حالة طلب', description: false, color: true }
} as const;

export type MaintenanceLookupKind = keyof typeof MAINTENANCE_LOOKUPS;

/**
 * تواريخ النظام (الإنشاء/التعديل/السجل) تُحفظ UTC وتصل بلا منطقة زمنية — نضيف Z ليعرضها المتصفح بالتوقيت المحلي.
 * (تاريخا البدء والإنجاز يسجّلهما الخادم بتوقيته المحلي ويُعرضان كما هما.)
 */
export function utcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
}

/** قيمة حقل datetime-local من تاريخ محفوظ (يُقص إلى الدقيقة) */
export function toLocalInput(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '';
}

/** الوقت الحالي بصيغة حقل datetime-local */
export function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** مدة بالساعات بصيغة مقروءة: "3 ساعات" أو "2 يوم و5 ساعات" */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} دقيقة`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} ساعة`;
  const days = Math.floor(hours / 24), rest = Math.round(hours - days * 24);
  return rest ? `${days} يوم و${rest} ساعة` : `${days} يوم`;
}
