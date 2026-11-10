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

  // سجل المواقع المشترك بين الفروع (أساس خرائط الفروع) — الحد: كل المواقع
  ViewSites: 'ViewSites', CreateSite: 'CreateSite', EditSite: 'EditSite', DeleteSite: 'DeleteSite',

  // طبقات خرائط الفروع: الطبقة ملك الفرع (طبقات فرعي)، والسجل يحمل قسم من أدخله (قسمي / فرعي مع ViewBranchMapEntries)
  ViewMapLayers: 'ViewMapLayers', CreateMapLayer: 'CreateMapLayer', EditMapLayer: 'EditMapLayer', DeleteMapLayer: 'DeleteMapLayer',
  ViewDepartmentMapEntries: 'ViewDepartmentMapEntries', ViewBranchMapEntries: 'ViewBranchMapEntries',
  CreateMapEntry: 'CreateMapEntry', EditMapEntry: 'EditMapEntry', DeleteMapEntry: 'DeleteMapEntry',

  // توثيق الأجهزة: التركيب ملك قسم من أضافه وفرعه — ViewDevices = تركيبات قسمي، ViewBranchDevices = فرعي كله
  ViewDevices: 'ViewDevices', ViewBranchDevices: 'ViewBranchDevices',
  CreateDevice: 'CreateDevice', EditDevice: 'EditDevice', DeleteDevice: 'DeleteDevice',
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
  IssueSparePart: 'IssueSparePart', ViewSparePartReports: 'ViewSparePartReports',

  // مركز التقارير: صلاحية سحب لكل تقرير (معاينة + Excel + طباعة) بحدود صفحة بياناته، وكل سحب يُسجَّل
  ExportVacationsReport: 'ExportVacationsReport', ExportVacationUsageReport: 'ExportVacationUsageReport',
  ExportUsersReport: 'ExportUsersReport', ExportStructureReport: 'ExportStructureReport',
  ExportMaintenanceRequestsReport: 'ExportMaintenanceRequestsReport', ExportTechniciansReport: 'ExportTechniciansReport',
  ExportSparePartMovementsReport: 'ExportSparePartMovementsReport', ExportSparePartStockReport: 'ExportSparePartStockReport',
  ExportInstallationsReport: 'ExportInstallationsReport', ExportSitesReport: 'ExportSitesReport', ExportMapEntriesReport: 'ExportMapEntriesReport',
  // تصدير لوحة المهام (من صفحتها) وسجل السحب
  ExportTasksReport: 'ExportTasksReport', ViewReportLog: 'ViewReportLog',

  // فرع الدراسات المركزية: حدّ كل صلاحية = دراسات فرعه (والمؤسسة كلها لنظرة المؤسسة)، ويحسبه الباكاند
  ViewStudyLookups: 'ViewStudyLookups', CreateStudyLookup: 'CreateStudyLookup', EditStudyLookup: 'EditStudyLookup', DeleteStudyLookup: 'DeleteStudyLookup',
  ViewStudyRequests: 'ViewStudyRequests', CreateStudyRequest: 'CreateStudyRequest', EditStudyRequest: 'EditStudyRequest', DeleteStudyRequest: 'DeleteStudyRequest',
  ViewStudyAssignments: 'ViewStudyAssignments', CreateStudyAssignment: 'CreateStudyAssignment',
  EditStudyAssignment: 'EditStudyAssignment', DeleteStudyAssignment: 'DeleteStudyAssignment',
  ViewStudyResponses: 'ViewStudyResponses', CreateStudyResponse: 'CreateStudyResponse', EditStudyResponse: 'EditStudyResponse', DeleteStudyResponse: 'DeleteStudyResponse',
  EditStudyResponsePlanning: 'EditStudyResponsePlanning',
  ViewStudyStartOrders: 'ViewStudyStartOrders', CreateStudyStartOrder: 'CreateStudyStartOrder',
  EditStudyStartOrder: 'EditStudyStartOrder', DeleteStudyStartOrder: 'DeleteStudyStartOrder',
  CancelStudyDocuments: 'CancelStudyDocuments',
  // التواقيع: صلاحية لكل صفة موقّع (صفات الأقسام الثلاث محدودة بقسم المستند)
  SignStudyAsFollowingDepartment: 'SignStudyAsFollowingDepartment', SignStudyAsPlanning: 'SignStudyAsPlanning',
  SignStudyAsCompetentDepartment: 'SignStudyAsCompetentDepartment', SignStudyAsBranchHead: 'SignStudyAsBranchHead',
  SignStudyAsSendingDepartment: 'SignStudyAsSendingDepartment', SignStudyAsDesignManagement: 'SignStudyAsDesignManagement',
  SignStudyAsQualityControl: 'SignStudyAsQualityControl', SignStudyAsProjectManagement: 'SignStudyAsProjectManagement',
  /** حدّ رؤية تفاصيل المشروع: الكاملة، أو مهام قسمي، أو مهام مكتبي (وبلا شيء منها مهامي فقط) */
  ViewFullStudyProject: 'ViewFullStudyProject', ViewDepartmentStudyTasks: 'ViewDepartmentStudyTasks', ViewOfficeStudyTasks: 'ViewOfficeStudyTasks',
  ViewStudyProjects: 'ViewStudyProjects', CreateStudyProject: 'CreateStudyProject', EditStudyProject: 'EditStudyProject', DeleteStudyProject: 'DeleteStudyProject',
  AddStudyProjectDepartment: 'AddStudyProjectDepartment', RemoveStudyProjectDepartment: 'RemoveStudyProjectDepartment',
  AddStudyProjectMember: 'AddStudyProjectMember', RemoveStudyProjectMember: 'RemoveStudyProjectMember',
  CreateStudyStage: 'CreateStudyStage', EditStudyStage: 'EditStudyStage', DeleteStudyStage: 'DeleteStudyStage', CloseStudyStage: 'CloseStudyStage',
  CreateStudyTask: 'CreateStudyTask', EditStudyTask: 'EditStudyTask', DeleteStudyTask: 'DeleteStudyTask', UpdateStudyTaskProgress: 'UpdateStudyTaskProgress',
  ViewStudyDrawings: 'ViewStudyDrawings', CreateStudyDrawing: 'CreateStudyDrawing', EditStudyDrawing: 'EditStudyDrawing',
  DeleteStudyDrawing: 'DeleteStudyDrawing', ReviewStudyDrawing: 'ReviewStudyDrawing',
  CreateArchitecturalVersion: 'CreateArchitecturalVersion', EditArchitecturalVersion: 'EditArchitecturalVersion', DeleteArchitecturalVersion: 'DeleteArchitecturalVersion',
  CreateDesignApproval: 'CreateDesignApproval', EditDesignApproval: 'EditDesignApproval', DeleteDesignApproval: 'DeleteDesignApproval',
  ViewStudyActivityLog: 'ViewStudyActivityLog', PrintStudyDocuments: 'PrintStudyDocuments'
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
/** صفحة «إجازاتي»: سجل طلباتي (ViewVacations) أو تقديم طلب (CreateVacation) */
export const MY_VACATIONS_ACCESS: readonly AppPermissionName[] = [AppPermission.ViewVacations, AppPermission.CreateVacation];
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
  AppPermission.ViewDevices, AppPermission.ViewBranchDevices, AppPermission.CreateDevice, AppPermission.EditDevice, AppPermission.DeleteDevice
];
/** سجلات طبقات الخرائط: أي صلاحية سجلات (سياسة AnyMapEntryView) */
export const MAP_ENTRY_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewDepartmentMapEntries, AppPermission.ViewBranchMapEntries,
  AppPermission.CreateMapEntry, AppPermission.EditMapEntry, AppPermission.DeleteMapEntry
];
/** صفحة «طبقات الفروع»: من يدير الطبقات أو يعمل على سجلاتها (سياسة AnyMapLayerRead) */
export const MAP_LAYER_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewMapLayers, AppPermission.CreateMapLayer, AppPermission.EditMapLayer, AppPermission.DeleteMapLayer, ...MAP_ENTRY_ACCESS
];
/** سجل المواقع: لمن يدير المواقع، ولمن يوثّق الأجهزة أو يسجّل معلومات الطبقات (يختار الموقع) — سياسة AnySiteView */
export const SITE_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ViewSites, AppPermission.CreateSite, AppPermission.EditSite, AppPermission.DeleteSite, ...DEVICE_ACCESS, ...MAP_ENTRY_ACCESS
];
/**
 * صفحة تفاصيل الموقع: من يملك صلاحية المواقع/الأجهزة/الطبقات، أو عرض مشاريع الدراسات (لرئيس فرع الدراسات يرى بطاقة المشاريع وحدها).
 * لكل بطاقة في الصفحة صلاحيتها (التركيبات = الأجهزة، المشاريع = ViewStudyProjects، معلومات الفروع = سجلات الطبقات)؛ سجل المواقع نفسه يبقى بـ SITE_ACCESS.
 */
export const SITE_PAGE_ACCESS: readonly AppPermissionName[] = [...SITE_ACCESS, AppPermission.ViewStudyProjects];
/** قراءة سجل المواقع (Sites/GetAll) لقائمة اختيار الموقع: نفس سياسة AnySiteView في الباك — SITE_ACCESS + عرض مشاريع الدراسات وكتابة الطلب */
export const SITE_PICK_ACCESS: readonly AppPermissionName[] = [...SITE_PAGE_ACCESS, AppPermission.CreateStudyRequest, AppPermission.EditStudyRequest];
/** مركز التقارير: صلاحية سحب أي تقرير (نفس سياسة AnyReportExport في الباكاند) */
export const REPORT_ACCESS: readonly AppPermissionName[] = [
  AppPermission.ExportVacationsReport, AppPermission.ExportVacationUsageReport, AppPermission.ExportUsersReport, AppPermission.ExportStructureReport,
  AppPermission.ExportMaintenanceRequestsReport, AppPermission.ExportTechniciansReport, AppPermission.ExportSparePartMovementsReport,
  AppPermission.ExportSparePartStockReport, AppPermission.ExportInstallationsReport, AppPermission.ExportSitesReport, AppPermission.ExportMapEntriesReport
];
/** إعدادات الدراسات (أنواع المراحل والمرفقات والاختصاصات): لمن يدير القوائم — العرض وحده للنماذج */
export const MANAGE_STUDY_LOOKUPS: readonly AppPermissionName[] = [AppPermission.CreateStudyLookup, AppPermission.EditStudyLookup, AppPermission.DeleteStudyLookup];
/** التوقيع بأي صفة (نفس سياسة AnyStudySign) — صندوق «بانتظار توقيعي» */
export const STUDY_SIGN: readonly AppPermissionName[] = [
  AppPermission.SignStudyAsFollowingDepartment, AppPermission.SignStudyAsPlanning, AppPermission.SignStudyAsCompetentDepartment,
  AppPermission.SignStudyAsBranchHead, AppPermission.SignStudyAsSendingDepartment, AppPermission.SignStudyAsDesignManagement,
  AppPermission.SignStudyAsQualityControl, AppPermission.SignStudyAsProjectManagement
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
/** صفحة «مستندات الدراسة»: عرض أي نوع من المستندات الأربعة */
export const STUDY_DOCUMENTS_VIEW: readonly AppPermissionName[] = [
  AppPermission.ViewStudyRequests, AppPermission.ViewStudyAssignments, AppPermission.ViewStudyResponses, AppPermission.ViewStudyStartOrders
];
