import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { APPROVE_VACATIONS, AppPermission, DASHBOARD_ACCESS, DEPARTMENT_DASHBOARD_ACCESS, DEVICE_ACCESS, OFFICE_DASHBOARD_ACCESS, WORK_TASK_VIEW, MANAGE_DEPARTMENTS, MANAGE_MAINTENANCE_LOOKUPS, MANAGE_VACATION_TYPES, VACATION_STATS } from './core/constants/access';
import { MainLayout } from './features/layout/main-layout';

/**
 * كل صفحة تُحمَّل عند فتحها فقط (loadComponent) — الحزمة الأولى تحتوي الإطار العام وصفحة الدخول فقط،
 * وباقي الصفحات تُحمَّل مسبقاً في الخلفية بعد أول عرض (PreloadAllModules في app.config).
 * الـ guards هنا للواجهة فقط؛ الباكاند يتحقق من كل صلاحية ونطاق بنفسه.
 */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  // صفحة طباعة خارج الإطار العام (بلا سايدبار): إيصال استلام / ورقة تسليم طلب صيانة
  {
    path: 'maintenance/print/:id/:kind', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests },
    loadComponent: () => import('./features/maintenance/request-print-page').then(m => m.MaintenancePrintPage)
  },
  // نموذج طلب الإجازة الورقي — خارج الإطار العام
  {
    path: 'vacations/print/:id', canActivate: [permissionGuard], data: { permission: AppPermission.PrintVacation },
    loadComponent: () => import('./features/vacations/vacation-print-page').then(m => m.VacationPrintPage)
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // لوحة المتابعة حسب الدور، والتنقل بين لوحات الفرع/القسم/المكتب
      { path: '', canActivate: [permissionGuard], data: { anyPermission: DASHBOARD_ACCESS }, loadComponent: () => import('./features/dashboard/dashboard-home').then(m => m.DashboardHome) },
      { path: 'dashboard/branch/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewBranchDashboard }, loadComponent: () => import('./features/dashboard/branch-dashboard').then(m => m.BranchDashboardPage) },
      { path: 'dashboard/department/:id', canActivate: [permissionGuard], data: { anyPermission: DEPARTMENT_DASHBOARD_ACCESS }, loadComponent: () => import('./features/dashboard/department-dashboard').then(m => m.DepartmentDashboardPage) },
      { path: 'dashboard/office/:id', canActivate: [permissionGuard], data: { anyPermission: OFFICE_DASHBOARD_ACCESS }, loadComponent: () => import('./features/dashboard/office-dashboard').then(m => m.OfficeDashboardPage) },

      // مهام العمل: صفحة كل مهمة "جاري العمل عليها" حالياً، والإدارة للسوبر ادمن
      { path: 'tasks/:id', canActivate: [permissionGuard], data: { anyPermission: WORK_TASK_VIEW }, loadComponent: () => import('./features/work-tasks/task-placeholder-page').then(m => m.TaskPlaceholderPage) },
      {
        path: 'work-tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ViewWorkTasks },
        loadComponent: () => import('./features/work-tasks/work-tasks-page').then(m => m.WorkTasksPage)
      },

      { path: 'profile', loadComponent: () => import('./features/profile/profile-page').then(m => m.ProfilePage) },
      { path: 'notifications', canActivate: [permissionGuard], data: { permission: AppPermission.ViewNotifications }, loadComponent: () => import('./features/notifications/notifications-page').then(m => m.NotificationsPage) },
      // لوحة المهام المُسندة: تحتاج ViewTaskBoard، والإسناد والمتابعة بصلاحيات AssignTaskTo* / HandleUnitTasks
      { path: 'task-board', canActivate: [permissionGuard], data: { permission: AppPermission.ViewTaskBoard }, loadComponent: () => import('./features/task-board/task-board-page').then(m => m.TaskBoardPage) },

      // توثيق الأجهزة: الحماية بصلاحيات الدور، مثل بقية الخدمات.
      {
        // من يضيف أو يعدّل أو يحذف يرى ما يعمل عليه (نفس DeviceAccessService في الباكاند)
        path: 'devices', canActivate: [permissionGuard],
        data: { anyPermission: DEVICE_ACCESS },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'installations' },
          { path: 'installations', loadComponent: () => import('./features/devices/installations-page').then(m => m.InstallationsPage) },
          { path: 'sites', loadComponent: () => import('./features/devices/sites-page').then(m => m.SitesPage) },
          { path: 'sites/:id', loadComponent: () => import('./features/devices/site-details-page').then(m => m.SiteDetailsPage) },
          { path: 'catalog', loadComponent: () => import('./features/devices/devices-catalog-page').then(m => m.DevicesCatalogPage) }
        ]
      },

      // الصيانة: طلبات (أجهزة العملاء)، مهام ميدانية، إحصائيات، وإعدادات القوائم — النطاق يحدده الباكاند
      {
        path: 'maintenance',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'requests' },
          {
            path: 'requests', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests },
            loadComponent: () => import('./features/maintenance/requests-page').then(m => m.MaintenanceRequestsPage)
          },
          {
            path: 'requests/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests },
            loadComponent: () => import('./features/maintenance/request-details-page').then(m => m.MaintenanceRequestDetailsPage)
          },
          {
            path: 'mine', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMyMaintenanceRequests },
            loadComponent: () => import('./features/maintenance/my-requests-page').then(m => m.MaintenanceMyRequestsPage)
          },
          {
            path: 'devices', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceDevices },
            loadComponent: () => import('./features/maintenance/devices-page').then(m => m.MaintenanceDevicesPage)
          },
          {
            path: 'parts', canActivate: [permissionGuard], data: { permission: AppPermission.ViewSpareParts },
            loadComponent: () => import('./features/maintenance/spare-parts-page').then(m => m.MaintenanceSparePartsPage)
          },
          {
            path: 'parts/report', canActivate: [permissionGuard], data: { permission: AppPermission.ViewSparePartReports },
            loadComponent: () => import('./features/maintenance/spare-parts-report-page').then(m => m.MaintenanceSparePartsReportPage)
          },
          {
            path: 'tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceTasks },
            loadComponent: () => import('./features/maintenance/tasks-page').then(m => m.MaintenanceTasksPage)
          },
          {
            path: 'stats', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceStats },
            loadComponent: () => import('./features/maintenance/stats-page').then(m => m.MaintenanceStatsPage)
          },
          {
            path: 'settings', canActivate: [permissionGuard],
            data: { anyPermission: MANAGE_MAINTENANCE_LOOKUPS },
            loadComponent: () => import('./features/maintenance/settings-page').then(m => m.MaintenanceSettingsPage)
          }
        ]
      },

      // الإجازات
      {
        path: 'vacations/review', canActivate: [permissionGuard], data: { anyPermission: APPROVE_VACATIONS },
        loadComponent: () => import('./features/vacations/vacation-review-page').then(m => m.VacationReviewPage)
      },
      {
        path: 'vacations/stats', canActivate: [permissionGuard], data: { anyPermission: VACATION_STATS },
        loadComponent: () => import('./features/vacations/vacation-stats-page').then(m => m.VacationStatsPage)
      },
      {
        path: 'vacation-types', canActivate: [permissionGuard], data: { anyPermission: MANAGE_VACATION_TYPES },
        loadComponent: () => import('./features/vacations/vacation-types-page').then(m => m.VacationTypesPage)
      },
      {
        path: 'vacations/holidays', canActivate: [permissionGuard], data: { permission: AppPermission.ViewHolidays },
        loadComponent: () => import('./features/vacations/holidays-page').then(m => m.HolidaysPage)
      },

      // إدارة الهيكل والمستخدمين: الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته
      {
        path: 'branches', canActivate: [permissionGuard], data: { permission: AppPermission.ViewBranches },
        loadComponent: () => import('./features/branches/branches-page').then(m => m.BranchesPage)
      },
      {
        path: 'departments', canActivate: [permissionGuard], data: { anyPermission: MANAGE_DEPARTMENTS },
        loadComponent: () => import('./features/departments/departments-page').then(m => m.DepartmentsPage)
      },
      {
        path: 'offices', canActivate: [permissionGuard], data: { permission: AppPermission.ViewOffices },
        loadComponent: () => import('./features/offices/offices-page').then(m => m.OfficesPage)
      },
      {
        path: 'users', canActivate: [permissionGuard], data: { permission: AppPermission.ViewUsers },
        loadComponent: () => import('./features/users/users-page').then(m => m.UsersPage)
      },
      {
        path: 'roles', canActivate: [permissionGuard], data: { permission: AppPermission.ViewRoles },
        loadComponent: () => import('./features/roles/roles-page').then(m => m.RolesPage)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
