/**
 * أسماء الأدوار والصلاحيات — نسخة مطابقة لـ Domain/Constants (AppRoles / AppPermissions) في الباكاند.
 * استخدمها بدل كتابة النص: خطأ إملائي في اسم صلاحية يخفي صفحة أو زراً بصمت.
 */
export const AppRole = {
  SuperAdmin: 'SuperAdmin',
  BranchManager: 'BranchManager',
  Manager: 'Manager',
  OfficeManager: 'OfficeManager',
  Employee: 'Emp'
} as const;

export type AppRoleName = (typeof AppRole)[keyof typeof AppRole];

export const AppPermission = {
  ManageUsers: 'ManageUsers',
  ManageBranches: 'ManageBranches',
  ManageDepartments: 'ManageDepartments',
  ManageOffices: 'ManageOffices',
  ManageRoles: 'ManageRoles',
  ViewVacations: 'ViewVacations',
  CreateVacation: 'CreateVacation',
  ApproveVacation: 'ApproveVacation',
  ManageVacations: 'ManageVacations',
  ManageVacationTypes: 'ManageVacationTypes',
  ManageWorkTasks: 'ManageWorkTasks',
  ViewDevices: 'ViewDevices',
  ManageDevices: 'ManageDevices'
} as const;

export type AppPermissionName = (typeof AppPermission)[keyof typeof AppPermission];

/** الرؤساء + مدير النظام — لهم صفحة إحصائيات الإجازات */
export const LEADER_ROLES: readonly string[] = [AppRole.SuperAdmin, AppRole.BranchManager, AppRole.Manager, AppRole.OfficeManager];
