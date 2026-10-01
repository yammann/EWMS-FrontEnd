/** جدول مساعد (نوع جهاز / شركة / نوع عطل / حالة طلب) — الحقول الاختيارية حسب الجدول */
export interface MaintenanceLookup {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export type MaintenanceStatus = MaintenanceLookup & { color: string };

export interface MaintenanceRequest {
  id: number;
  /** الرقم المعروض: MR-2026-00125 */
  number: string;
  /** ما يستطيعه المستخدم الحالي على هذا الطلب (النطاق — الصلاحية تُفحص منفصلة) */
  canEdit: boolean;
  canAssign: boolean;

  userId: number;
  technicianName: string;
  departmentId: number | null;
  departmentName: string;

  clientName: string;
  clientPhone: string;

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

  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MaintenanceRequestInput {
  clientName: string;
  clientPhone: string;
  deviceTypeId: number;
  damageTypeId: number;
  deviceCompanyId: number;
  model: string;
  accessories: string;
  serialNumber: string;
  description: string;
  maintenanceRequestStatusId: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MaintenanceRequestFilter {
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

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TechnicianOption { id: number; fullName: string; }

/** 1 تسجيل، 2 تغيير حالة، 3 نقل لفني آخر، 4 تعديل */
export interface MaintenanceActivity {
  id: number;
  type: 1 | 2 | 3 | 4;
  text: string;
  userId: number;
  userName: string;
  createdAt: string;
}

export interface MaintenancePrint {
  request: MaintenanceRequest;
  managerName: string;
  managerSignature: string | null;
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
 * (تاريخا البدء والإنجاز يدخلهما المستخدم بتوقيته المحلي ويُعرضان كما هما.)
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
