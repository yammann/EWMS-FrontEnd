/**
 * أسماء الأدوار والصلاحيات — الصلاحيات نسخة مطابقة لـ Application/Common/AppPermissions.cs في الباكاند
 * (صلاحية لكل عملية: View / Create / Edit / Delete — لا توجد صلاحيات Manage…).
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
  ViewUsers: 'ViewUsers', CreateUser: 'CreateUser', EditUser: 'EditUser', DeleteUser: 'DeleteUser',
  ViewBranches: 'ViewBranches', CreateBranch: 'CreateBranch', EditBranch: 'EditBranch', DeleteBranch: 'DeleteBranch',
  ViewDepartments: 'ViewDepartments', CreateDepartment: 'CreateDepartment', EditDepartment: 'EditDepartment', DeleteDepartment: 'DeleteDepartment',
  ViewOffices: 'ViewOffices', CreateOffice: 'CreateOffice', EditOffice: 'EditOffice', DeleteOffice: 'DeleteOffice',
  ViewRoles: 'ViewRoles', CreateRole: 'CreateRole', EditRole: 'EditRole', DeleteRole: 'DeleteRole',
  // الانتماء لخدمة مُسندة لوحدتي (AppModules.AccessPolicy في الباكاند) — لما لا صلاحية خاصة له
  ModuleVacations: 'Module.Vacations', ModuleTaskBoard: 'Module.TaskBoard', ModuleWorkTasks: 'Module.WorkTasks',
  ModuleDeviceInventory: 'Module.DeviceInventory', ModuleMaintenance: 'Module.Maintenance',

  // إسناد الخدمات للوحدات التنظيمية التي تملكها
  ViewModuleAssignments: 'ViewModuleAssignments', EditModuleAssignments: 'EditModuleAssignments',

  ViewVacations: 'ViewVacations', CreateVacation: 'CreateVacation', CancelVacation: 'CancelVacation', ApproveVacation: 'ApproveVacation',
  ViewVacationTypes: 'ViewVacationTypes', CreateVacationType: 'CreateVacationType', EditVacationType: 'EditVacationType', DeleteVacationType: 'DeleteVacationType',

  ViewWorkTasks: 'ViewWorkTasks', CreateWorkTask: 'CreateWorkTask', EditWorkTask: 'EditWorkTask', DeleteWorkTask: 'DeleteWorkTask',

  // توثيق الأجهزة: الواجهة تعتمد Devices/MyAccess (الصلاحية أو القسم المالك) لا هذه الأسماء مباشرة
  ViewDevices: 'ViewDevices', CreateDevice: 'CreateDevice', EditDevice: 'EditDevice', DeleteDevice: 'DeleteDevice',

  ViewMaintenanceRequests: 'ViewMaintenanceRequests', CreateMaintenanceRequest: 'CreateMaintenanceRequest',
  EditMaintenanceRequest: 'EditMaintenanceRequest', DeleteMaintenanceRequest: 'DeleteMaintenanceRequest',
  ViewMaintenanceTasks: 'ViewMaintenanceTasks', CreateMaintenanceTask: 'CreateMaintenanceTask',
  EditMaintenanceTask: 'EditMaintenanceTask', DeleteMaintenanceTask: 'DeleteMaintenanceTask',
  ViewMaintenanceLookups: 'ViewMaintenanceLookups', CreateMaintenanceLookup: 'CreateMaintenanceLookup',
  EditMaintenanceLookup: 'EditMaintenanceLookup', DeleteMaintenanceLookup: 'DeleteMaintenanceLookup'
} as const;

export type AppPermissionName = (typeof AppPermission)[keyof typeof AppPermission];

/**
 * صفحات إدارة قوائم يقرؤها الجميع (الأقسام وأنواع الإجازات وجداول الصيانة): صلاحية "عرض" وحدها تُمنح
 * لكل من يحتاج القائمة في نموذج، فلا تكفي لإظهار صفحة الإدارة — تظهر لمن يملك إضافة أو تعديلاً أو حذفاً.
 */
export const MANAGE_DEPARTMENTS: readonly AppPermissionName[] = [AppPermission.CreateDepartment, AppPermission.EditDepartment, AppPermission.DeleteDepartment];
export const MANAGE_VACATION_TYPES: readonly AppPermissionName[] = [AppPermission.CreateVacationType, AppPermission.EditVacationType, AppPermission.DeleteVacationType];
export const MANAGE_MAINTENANCE_LOOKUPS: readonly AppPermissionName[] = [AppPermission.CreateMaintenanceLookup, AppPermission.EditMaintenanceLookup, AppPermission.DeleteMaintenanceLookup];

/** الرؤساء + مدير النظام — لهم صفحة إحصائيات الإجازات */
export const LEADER_ROLES: readonly string[] = [AppRole.SuperAdmin, AppRole.BranchManager, AppRole.Manager, AppRole.OfficeManager];
