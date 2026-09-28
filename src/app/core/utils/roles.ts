/** أسماء الأدوار بالعربي للعرض (الباكاند يستخدم الأسماء الإنجليزية) */
const ROLE_LABELS: Record<string, string> = {
  superadmin: 'مدير النظام',
  branchmanager: 'رئيس الفرع',
  manager: 'رئيس القسم',
  officemanager: 'رئيس المكتب',
  emp: 'موظف'
};

export function roleLabel(roleName: string | null | undefined): string {
  return ROLE_LABELS[(roleName ?? '').toLowerCase()] ?? roleName ?? '';
}

/** الرؤساء + مدير النظام — لهم صفحة إحصائيات الإجازات */
export const LEADER_ROLES = ['SuperAdmin', 'BranchManager', 'Manager', 'OfficeManager'];

export type DashboardKind = 'overview' | 'branch' | 'department' | 'office' | 'employee';

/** أي لوحة متابعة تظهر للمستخدم في الصفحة الرئيسية */
export function dashboardKindFor(roleName: string | null | undefined): DashboardKind {
  switch ((roleName ?? '').toLowerCase()) {
    case 'superadmin': return 'overview';
    case 'branchmanager': return 'branch';
    case 'manager': return 'department';
    case 'officemanager': return 'office';
    default: return 'employee';
  }
}
