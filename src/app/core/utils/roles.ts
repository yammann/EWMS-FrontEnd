import { AppRole } from '../constants/access';

/** أسماء الأدوار بالعربي للعرض (الباكاند يستخدم الأسماء الإنجليزية) */
const ROLE_LABELS: Record<string, string> = {
  [AppRole.SuperAdmin.toLowerCase()]: 'مدير النظام',
  [AppRole.BranchManager.toLowerCase()]: 'رئيس الفرع',
  [AppRole.Manager.toLowerCase()]: 'رئيس القسم',
  [AppRole.OfficeManager.toLowerCase()]: 'رئيس المكتب',
  [AppRole.Employee.toLowerCase()]: 'موظف'
};

export function roleLabel(roleName: string | null | undefined): string {
  return ROLE_LABELS[(roleName ?? '').toLowerCase()] ?? roleName ?? '';
}

export type DashboardKind = 'overview' | 'branch' | 'department' | 'office' | 'employee';

const DASHBOARD_BY_ROLE: Record<string, DashboardKind> = {
  [AppRole.SuperAdmin]: 'overview',
  [AppRole.BranchManager]: 'branch',
  [AppRole.Manager]: 'department',
  [AppRole.OfficeManager]: 'office'
};

/** أي لوحة متابعة تظهر للمستخدم في الصفحة الرئيسية (الأدوار المخصّصة تُعامل كموظف) */
export function dashboardKindFor(roleName: string | null | undefined): DashboardKind {
  const match = Object.keys(DASHBOARD_BY_ROLE).find(role => role.toLowerCase() === (roleName ?? '').toLowerCase());
  return match ? DASHBOARD_BY_ROLE[match] : 'employee';
}
