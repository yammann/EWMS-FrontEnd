/**
 * أسماء الأدوار والصلاحيات — الصلاحيات نسخة مطابقة لـ Application/Common/AppPermissions.cs في الباكاند
 * (صلاحية لكل عملية: View / Create / Edit / Delete — لا توجد صلاحيات Manage…).
 * استخدمها بدل كتابة النص: خطأ إملائي في اسم صلاحية يخفي صفحة أو زراً بصمت.
 */
export const AppPermission = {
  ViewUsers: 'ViewUsers', CreateUser: 'CreateUser', EditUser: 'EditUser', ToggleUserActive: 'ToggleUserActive', DeleteUser: 'DeleteUser',
  ViewBranches: 'ViewBranches', CreateBranch: 'CreateBranch', EditBranch: 'EditBranch', DeleteBranch: 'DeleteBranch',
  ViewDepartments: 'ViewDepartments', CreateDepartment: 'CreateDepartment', EditDepartment: 'EditDepartment', DeleteDepartment: 'DeleteDepartment',
  ViewOffices: 'ViewOffices', CreateOffice: 'CreateOffice', EditOffice: 'EditOffice', DeleteOffice: 'DeleteOffice',
  ViewRoles: 'ViewRoles', CreateRole: 'CreateRole', EditRole: 'EditRole', DeleteRole: 'DeleteRole',
  // كل صلاحية تحمل حدّها: ViewVacations = إجازاتي، وقسمي/فرعي بصلاحيتين منفصلتين، والموافقة مرحلتان لإجازات فرعه
  ViewVacations: 'ViewVacations', ViewDepartmentVacations: 'ViewDepartmentVacations', ViewBranchVacations: 'ViewBranchVacations',
  CreateVacation: 'CreateVacation', CancelVacation: 'CancelVacation',
  ApproveVacationFirst: 'ApproveVacationFirst', ApproveVacationFinal: 'ApproveVacationFinal', PrintVacation: 'PrintVacation',
  ViewVacationTypes: 'ViewVacationTypes', CreateVacationType: 'CreateVacationType', EditVacationType: 'EditVacationType', DeleteVacationType: 'DeleteVacationType',
  // العطل الرسمية: لا تُحسب من مدة الإجازة (مع الجمعة)
  ViewHolidays: 'ViewHolidays', CreateHoliday: 'CreateHoliday', EditHoliday: 'EditHoliday', DeleteHoliday: 'DeleteHoliday',

  // لوحات المتابعة: لوحة وحدة المستخدم وما تحتها
  ViewBranchDashboard: 'ViewBranchDashboard', ViewDepartmentDashboard: 'ViewDepartmentDashboard', ViewOfficeDashboard: 'ViewOfficeDashboard',
  ViewBranchMap: 'ViewBranchMap',
  // لا لوحة ولا إشعارات ولا مهام شخصية بلا صلاحية (قرار 2026-10-03: لا شيء مفتوح للجميع)
  ViewOrganizationDashboard: 'ViewOrganizationDashboard', ViewMyDashboard: 'ViewMyDashboard',
  ViewMyWorkTasks: 'ViewMyWorkTasks', ViewNotifications: 'ViewNotifications',

  ViewWorkTasks: 'ViewWorkTasks', CreateWorkTask: 'CreateWorkTask', EditWorkTask: 'EditWorkTask', DeleteWorkTask: 'DeleteWorkTask',

  // لوحة المهام: ViewTaskBoard تفتح اللوحة (واستقبال ما أُسند للمستخدم شخصياً)؛ الإسناد والتولّي بصلاحيات
  ViewTaskBoard: 'ViewTaskBoard',
  AssignTaskToDepartment: 'AssignTaskToDepartment', AssignTaskToOffice: 'AssignTaskToOffice', AssignTaskToUser: 'AssignTaskToUser',
  HandleUnitTasks: 'HandleUnitTasks', ViewTaskStats: 'ViewTaskStats',

  // قوائم المهام الشخصية: كل صلاحية على قوائمه هو فقط
  ViewToDoLists: 'ViewToDoLists', CreateToDoList: 'CreateToDoList', EditToDoList: 'EditToDoList', DeleteToDoList: 'DeleteToDoList',

  // توثيق الأجهزة (Devices/MyAccess يعيد نفس النتيجة من صلاحيات الدور)
  ViewDevices: 'ViewDevices', CreateDevice: 'CreateDevice', EditDevice: 'EditDevice', DeleteDevice: 'DeleteDevice',
  // إظهار كلمات سر الأجهزة ونسخها (يُسجَّل كل إظهار) — مستقلة عن العرض
  RevealDevicePasswords: 'RevealDevicePasswords',

  ViewDepartmentMaintenance: 'ViewDepartmentMaintenance', SignMaintenanceReceipt: 'SignMaintenanceReceipt',
  // التوقيع الإلكتروني: رفعه وتغييره بكلمة المرور، ويُحفظ مع القرارات الموقَّعة
  ManageMySignature: 'ManageMySignature',
  ViewMaintenanceRequests: 'ViewMaintenanceRequests', CreateMaintenanceRequest: 'CreateMaintenanceRequest',
  EditMaintenanceRequest: 'EditMaintenanceRequest', ChangeMaintenanceStatus: 'ChangeMaintenanceStatus', ViewMaintenanceStats: 'ViewMaintenanceStats',
  DeleteMaintenanceRequest: 'DeleteMaintenanceRequest',
  AssignMaintenanceRequest: 'AssignMaintenanceRequest',
  // الفني يطلب تحويل طلب مسند إليه إلى موظف آخر (يقرّره صاحب AssignMaintenanceRequest)
  RequestMaintenanceTransfer: 'RequestMaintenanceTransfer',
  // «أجهزتي في الصيانة»: طلبات أنا عميلها
  ViewMyMaintenanceRequests: 'ViewMyMaintenanceRequests',
  ViewMaintenanceTasks: 'ViewMaintenanceTasks', CreateMaintenanceTask: 'CreateMaintenanceTask',
  EditMaintenanceTask: 'EditMaintenanceTask', DeleteMaintenanceTask: 'DeleteMaintenanceTask',
  AssignMaintenanceTask: 'AssignMaintenanceTask',
  ViewMaintenanceLookups: 'ViewMaintenanceLookups', CreateMaintenanceLookup: 'CreateMaintenanceLookup',
  EditMaintenanceLookup: 'EditMaintenanceLookup', DeleteMaintenanceLookup: 'DeleteMaintenanceLookup',
  // أجهزة الصيانة: سجل مشترك للأجهزة برقمها التسلسلي (تقديم طلب يحتاج العرض، وجهاز جديد يحتاج الإضافة)
  ViewMaintenanceDevices: 'ViewMaintenanceDevices', CreateMaintenanceDevice: 'CreateMaintenanceDevice',
  EditMaintenanceDevice: 'EditMaintenanceDevice', DeleteMaintenanceDevice: 'DeleteMaintenanceDevice',
  // مخزون قطع الغيار: مخزون لكل قسم، والصرف على طلبات الصيانة
  ViewSpareParts: 'ViewSpareParts', CreateSparePart: 'CreateSparePart', EditSparePart: 'EditSparePart', DeleteSparePart: 'DeleteSparePart',
  ReceiveSpareParts: 'ReceiveSpareParts', AdjustSparePartStock: 'AdjustSparePartStock',
  IssueSparePart: 'IssueSparePart', ViewSparePartReports: 'ViewSparePartReports'
} as const;

export type AppPermissionName = (typeof AppPermission)[keyof typeof AppPermission];

/**
 * صفحات إدارة قوائم يقرؤها الجميع (الأقسام وأنواع الإجازات وجداول الصيانة): صلاحية "عرض" وحدها تُمنح
 * لكل من يحتاج القائمة في نموذج، فلا تكفي لإظهار صفحة الإدارة — تظهر لمن يملك إضافة أو تعديلاً أو حذفاً.
 */
export const MANAGE_DEPARTMENTS: readonly AppPermissionName[] = [AppPermission.CreateDepartment, AppPermission.EditDepartment, AppPermission.DeleteDepartment];
export const MANAGE_VACATION_TYPES: readonly AppPermissionName[] = [AppPermission.CreateVacationType, AppPermission.EditVacationType, AppPermission.DeleteVacationType];
export const MANAGE_MAINTENANCE_LOOKUPS: readonly AppPermissionName[] = [AppPermission.CreateMaintenanceLookup, AppPermission.EditMaintenanceLookup, AppPermission.DeleteMaintenanceLookup];

/** أي صلاحية موافقة على الإجازات (الأولى أو النهائية) */
export const APPROVE_VACATIONS: readonly AppPermissionName[] = [AppPermission.ApproveVacationFirst, AppPermission.ApproveVacationFinal];
/** إحصائيات الإجازات: لمن يرى إجازات قسمه أو فرعه */
export const VACATION_STATS: readonly AppPermissionName[] = [AppPermission.ViewDepartmentVacations, AppPermission.ViewBranchVacations];
/** يتابع مهام وحدة (يُظهر تبويب "كل مهام نطاقي") */
/** من يملك صلاحية إسناد: يدير قوالبه ومهامه الدورية */
export const TASK_ASSIGN: readonly AppPermissionName[] = [
  AppPermission.AssignTaskToDepartment, AppPermission.AssignTaskToOffice, AppPermission.AssignTaskToUser
];

export const TASK_OVERSIGHT: readonly AppPermissionName[] = [
  AppPermission.AssignTaskToDepartment, AppPermission.AssignTaskToOffice, AppPermission.AssignTaskToUser, AppPermission.HandleUnitTasks
];
/** توثيق الأجهزة: من يضيف أو يعدّل أو يحذف يرى ما يعمل عليه (نفس سياسة AnyDeviceView في الباكاند) */
export const DEVICE_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewDevices, AppPermission.CreateDevice, AppPermission.EditDevice, AppPermission.DeleteDevice
];
/** أي لوحة متابعة (الصفحة الرئيسية) */
export const DASHBOARD_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewOrganizationDashboard, AppPermission.ViewBranchDashboard, AppPermission.ViewDepartmentDashboard,
  AppPermission.ViewOfficeDashboard, AppPermission.ViewMyDashboard
];
export const DEPARTMENT_DASHBOARD_ACCESS: readonly AppPermissionName[] = [AppPermission.ViewBranchDashboard, AppPermission.ViewDepartmentDashboard];
export const OFFICE_DASHBOARD_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewBranchDashboard, AppPermission.ViewDepartmentDashboard, AppPermission.ViewOfficeDashboard
];
/** صفحة مهمة عمل: المسنَدة لي أو أي صلاحية إشراف (نفس AnyWorkTaskView في الباكاند) */
export const WORK_TASK_VIEW: readonly AppPermissionName[] = [
  AppPermission.ViewMyWorkTasks, AppPermission.ViewWorkTasks, AppPermission.ViewBranchDashboard,
  AppPermission.ViewDepartmentDashboard, AppPermission.ViewOfficeDashboard
];
