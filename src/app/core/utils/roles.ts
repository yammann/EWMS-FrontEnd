import { AppRole } from '../constants/access';

/** أسماء الأدوار بالعربي للعرض (الباكاند يستخدم الأسماء الإنجليزية) */
const ROLE_LABELS: Record<string, string> = {
  [AppRole.SuperAdmin.toLowerCase()]: 'مدير النظام',
  [AppRole.BranchManager.toLowerCase()]: 'رئيس الفرع',
  [AppRole.Manager.toLowerCase()]: 'رئيس القسم',
  departmentmanager: 'رئيس القسم', // الاسم الجديد لدور رئيس القسم في الـ seeder
  [AppRole.OfficeManager.toLowerCase()]: 'رئيس المكتب',
  [AppRole.Employee.toLowerCase()]: 'موظف'
};

/** مستويات الأدوار للاختيار في صفحة الأدوار (المستوى هو ما يعتمد عليه النظام، والاسم حر) */
export const ROLE_LEVELS: { value: string; label: string; hint: string }[] = [
  { value: AppRole.BranchManager, label: 'رئيس فرع', hint: 'يتبع لفرع فقط — يوافق على الإجازات نهائياً ويطّلع على خدمات أقسام فرعه' },
  { value: AppRole.Manager, label: 'رئيس قسم', hint: 'يتبع لفرع وقسم بلا مكتب — يدير سجلات قسمه ويوافق على إجازاته' },
  { value: AppRole.OfficeManager, label: 'رئيس مكتب', hint: 'يتبع لفرع وقسم ومكتب — يتابع سجلات مكتبه' },
  { value: AppRole.Employee, label: 'موظف', hint: 'يتبع لفرع وقسم ومكتب — يرى سجلاته فقط' }
];

export function roleLevelLabel(level: string | null | undefined): string {
  return level === AppRole.SuperAdmin ? 'مدير النظام' : ROLE_LEVELS.find(l => l.value === level)?.label ?? 'موظف';
}

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
