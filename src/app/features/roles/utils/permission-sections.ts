/**
 * شجرة الصلاحيات في نافذتي الدور: أقسام ثابتة (عناوين في أعلى القائمة) ← مجموعات قابلة للطي ← صلاحيات.
 * ما لا يرد هنا من صلاحيات جديدة يظهر في قسم "أخرى" فلا يضيع — أضفه لمجموعته حين تُضاف إلى AppPermissions في الباكاند.
 */
export const PERMISSION_SECTIONS: { key: string; title: string; groups: { key: string; title: string; names: string[] }[] }[] = [
  { key: 'vacations', title: 'الإجازات', groups: [
    { key: 'vac-own', title: 'طلبات الإجازة', names: ['ViewVacations', 'CreateVacation', 'CancelVacation', 'PrintVacation'] },
    { key: 'vac-view', title: 'الاطلاع على إجازات الآخرين', names: ['ViewDepartmentVacations', 'ViewBranchVacations'] },
    { key: 'vac-approve', title: 'الموافقة على الإجازات', names: ['ApproveVacationFirst', 'ApproveVacationFinal'] },
    { key: 'vacation-types', title: 'أنواع الإجازات', names: ['ViewVacationTypes', 'CreateVacationType', 'EditVacationType', 'DeleteVacationType'] },
    { key: 'holidays', title: 'العطل الرسمية', names: ['ViewHolidays', 'CreateHoliday', 'EditHoliday', 'DeleteHoliday'] }
  ] },
  { key: 'tasks', title: 'المهام', groups: [
    { key: 'task-board', title: 'لوحة المهام', names: ['ViewTaskBoard', 'AssignTaskToDepartment', 'AssignTaskToOffice', 'AssignTaskToUser', 'AssignTaskToDepartmentUser', 'AssignTaskToBranchUser', 'HandleUnitTasks', 'ViewTaskStats'] },
    { key: 'todo-lists', title: 'مفكرتي — قوائم المهام الشخصية (قوائمه هو فقط؛ البنود والتثبيت والأرشفة بصلاحية التعديل)', names: ['ViewToDoLists', 'CreateToDoList', 'EditToDoList', 'DeleteToDoList'] },
    { key: 'work-tasks', title: 'مهام العمل', names: ['ViewMyWorkTasks', 'ViewWorkTasks', 'CreateWorkTask', 'EditWorkTask', 'DeleteWorkTask'] }
  ] },
  { key: 'maintenance', title: 'الصيانة', groups: [
    { key: 'maint-requests', title: 'طلبات الصيانة', names: ['ViewMaintenanceRequests', 'CreateMaintenanceRequest', 'EditMaintenanceRequest', 'ChangeMaintenanceStatus', 'DeleteMaintenanceRequest', 'AssignMaintenanceRequest', 'RequestMaintenanceTransfer'] },
    { key: 'maint-mine', title: 'متابعة أجهزتي في الصيانة', names: ['ViewMyMaintenanceRequests'] },
    { key: 'maint-devices', title: 'أجهزة الصيانة', names: ['ViewMaintenanceDevices', 'CreateMaintenanceDevice', 'EditMaintenanceDevice', 'DeleteMaintenanceDevice'] },
    { key: 'maint-parts', title: 'قطع الغيار (مخزون القسم والصرف على الطلبات)', names: ['ViewSpareParts', 'CreateSparePart', 'EditSparePart', 'DeleteSparePart', 'ReceiveSpareParts', 'AdjustSparePartStock', 'IssueSparePart', 'ViewSparePartReports'] },
    { key: 'maint-tasks', title: 'مهام الصيانة', names: ['ViewMaintenanceTasks', 'CreateMaintenanceTask', 'EditMaintenanceTask', 'DeleteMaintenanceTask', 'AssignMaintenanceTask'] },
    { key: 'maint-department', title: 'الإشراف على صيانة القسم', names: ['ViewDepartmentMaintenance', 'ViewMaintenanceStats', 'SignMaintenanceReceipt'] },
    { key: 'maint-lookups', title: 'جداول الصيانة (أنواع الأجهزة والشركات والأعطال والحالات)', names: ['ViewMaintenanceLookups', 'CreateMaintenanceLookup', 'EditMaintenanceLookup', 'DeleteMaintenanceLookup'] }
  ] },
  { key: 'general', title: 'عام', groups: [
    { key: 'notifications', title: 'الإشعارات', names: ['ViewNotifications'] },
    { key: 'signature', title: 'التوقيع الإلكتروني', names: ['ManageMySignature'] }
  ] },
  { key: 'sites', title: 'الخريطة والمواقع', groups: [
    { key: 'sites', title: 'سجل المواقع المشترك بين الفروع', names: ['ViewSites', 'CreateSite', 'EditSite', 'DeleteSite'] },
    { key: 'branch-map', title: 'خريطة الفرع', names: ['ViewBranchMap'] },
    { key: 'map-layers', title: 'طبقات الفرع وحقولها (الطبقة ملك الفرع)', names: ['ViewMapLayers', 'CreateMapLayer', 'EditMapLayer', 'DeleteMapLayer'] },
    { key: 'map-entries', title: 'سجلات الطبقات على المواقع (السجل ملك قسم من أضافه)', names: ['ViewDepartmentMapEntries', 'ViewBranchMapEntries', 'CreateMapEntry', 'EditMapEntry', 'DeleteMapEntry'] }
  ] },
  { key: 'projects', title: 'المشاريع', groups: [
    { key: 'projects', title: 'المشاريع (مشاريعي = مشارك أو منشئ، ثم قسمي، ثم فرعي)', names: ['ViewProjects', 'ViewDepartmentProjects', 'ViewBranchProjects', 'CreateProject', 'EditProject'] },
    { key: 'project-docs', title: 'وثائق المشاريع (بحدّ المشاريع التي يراها)', names: ['ViewProjectDocuments', 'DownloadProjectDocument', 'UploadProjectDocument', 'ApproveProjectDocument', 'DeleteProjectDocument'] },
    { key: 'project-audit', title: 'سجل تدقيق المشاريع', names: ['ViewProjectAudit'] },
    { key: 'project-schedule', title: 'الجدول الزمني (الإعداد غير الاعتماد، والاعتماد لغير من أعدّ)', names: ['ViewProjectSchedule', 'EditProjectStartOrder', 'EditProjectSchedule', 'ApproveProjectSchedule', 'UpdateScheduleProgress', 'ClassifyScheduleTask'] },
    { key: 'project-delays', title: 'التأخير والتمديد', names: ['RecordScheduleDelay', 'ApproveDelayJustification', 'RequestScheduleExtension', 'ApproveScheduleExtension'] },
    { key: 'studies', title: 'الدراسات والمكاتب الفنية (بحدّ المشاريع التي يراها؛ المراجع غير من أعدّ المخرج)', names: ['ViewStudies', 'CreateStudyOrder', 'EditStudyOrder', 'PrepareStudyDeliverable', 'ReviewStudyDeliverable', 'RecordStudySubmission'] },
    { key: 'deliverable-types', title: 'أنواع المخرجات الفنية (إعدادات الفرع)', names: ['ViewDeliverableTypes', 'CreateDeliverableType', 'EditDeliverableType', 'DeleteDeliverableType'] }
  ] },
  { key: 'contracts', title: 'العقود والتسليم والكفالة', groups: [
    { key: 'contracts-work', title: 'العقود (بحدّ المشاريع التي يراها؛ المبالغ يدوية بلا معادلات)', names: ['ViewContracts', 'CreateContract', 'EditContract', 'ManageContractCommittees', 'AddContractAmendment', 'RecordContractRetention'] },
    { key: 'contractors', title: 'المقاولون (بيانات الفرع)', names: ['ViewContractors', 'CreateContractor', 'EditContractor', 'DeleteContractor'] },
    { key: 'contractor-evaluations', title: 'تقييم المقاولين (من أعدّ التقييم لا يراجعه)', names: ['ViewContractorEvaluations', 'EvaluateContractor', 'ReviewContractorEvaluation'] },
    { key: 'evaluation-criteria', title: 'معايير التقييم (إعدادات الفرع، بلا مجموع ولا تصنيف)', names: ['ViewEvaluationCriteria', 'CreateEvaluationCriterion', 'EditEvaluationCriterion', 'DeleteEvaluationCriterion'] },
    { key: 'handovers', title: 'الاستلام والتسليم (بحدّ المشاريع التي يراها؛ من عالج الملاحظة لا يتحقق منها)', names: ['ViewHandovers', 'RequestHandover', 'ManageHandover', 'FollowHandoverNotes'] }
  ] },
  { key: 'diwan', title: 'الديوان', groups: [
    { key: 'diwan-view', title: 'الاطلاع على المعاملات (معاملاتي = سجّلتها أو أُحيلت إليّ أو مرّت بي، ثم قسمي، ثم فرعي)', names: ['ViewCorrespondence', 'ViewDepartmentCorrespondence', 'ViewBranchCorrespondence'] },
    { key: 'diwan-work', title: 'تسجيل المعاملات ومعالجتها (الإحالة لا تفتح المعاملة إلا لحاملي المعالجة في الوحدة الحالية)', names: ['RegisterCorrespondence', 'ReferCorrespondence', 'HandleCorrespondence', 'CloseCorrespondence'] },
    { key: 'diwan-outgoing', title: 'اعتماد الصادر (لغير من أعدّ المسودة)', names: ['ApproveOutgoingCorrespondence'] },
    { key: 'diwan-lookups', title: 'أنواع المعاملات وحالاتها (إعدادات الفرع)', names: ['ViewCorrespondenceLookups', 'CreateCorrespondenceLookup', 'EditCorrespondenceLookup', 'DeleteCorrespondenceLookup'] }
  ] },
  { key: 'devices', title: 'توثيق الأجهزة', groups: [
    { key: 'devices', title: 'كتالوج الأجهزة والتركيبات (التركيب ملك قسم من أضافه)', names: ['ViewDevices', 'ViewBranchDevices', 'CreateDevice', 'EditDevice', 'DeleteDevice', 'RevealDevicePasswords'] }
  ] },
  { key: 'dashboards', title: 'لوحات المتابعة', groups: [
    { key: 'dashboards', title: 'لوحات المتابعة', names: ['ViewOrganizationDashboard', 'ViewBranchDashboard', 'ViewDepartmentDashboard', 'ViewOfficeDashboard', 'ViewMyDashboard'] }
  ] },
  { key: 'reports', title: 'التقارير', groups: [
    { key: 'reports-vac', title: 'تقارير الإجازات', names: ['ExportVacationsReport', 'ExportVacationUsageReport'] },
    { key: 'reports-staff', title: 'تقارير الموظفين والهيكل', names: ['ExportUsersReport', 'ExportStructureReport'] },
    { key: 'reports-maint', title: 'تقارير الصيانة وقطع الغيار', names: ['ExportMaintenanceRequestsReport', 'ExportTechniciansReport', 'ExportSparePartMovementsReport', 'ExportSparePartStockReport'] },
    { key: 'reports-devices', title: 'تقارير الأجهزة والخريطة', names: ['ExportInstallationsReport', 'ExportSitesReport', 'ExportMapEntriesReport'] },
    { key: 'reports-projects', title: 'تقارير المشاريع', names: ['ExportProjectsReport', 'ExportStudiesReport', 'ExportContractsReport'] },
    { key: 'reports-diwan', title: 'تقارير الديوان', names: ['ExportCorrespondenceReport', 'ExportOverdueCorrespondenceReport'] },
    { key: 'reports-other', title: 'تصدير لوحة المهام وسجل السحب', names: ['ExportTasksReport', 'ViewReportLog'] }
  ] },
  { key: 'admin', title: 'الإدارة والهيكل', groups: [
    { key: 'users', title: 'الموظفون', names: ['ViewUsers', 'CreateUser', 'EditUser', 'ToggleUserActive', 'DeleteUser'] },
    { key: 'roles', title: 'الأدوار والصلاحيات', names: ['ViewRoles', 'CreateRole', 'EditRole', 'DeleteRole'] },
    { key: 'branches', title: 'الفروع', names: ['ViewBranches', 'CreateBranch', 'EditBranch', 'DeleteBranch'] },
    { key: 'departments', title: 'الأقسام', names: ['ViewDepartments', 'CreateDepartment', 'EditDepartment', 'DeleteDepartment'] },
    { key: 'offices', title: 'المكاتب', names: ['ViewOffices', 'CreateOffice', 'EditOffice', 'DeleteOffice'] }
  ] }
];
