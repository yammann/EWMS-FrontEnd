// يولّد ملفات <feature>.routes.ts من تعريفات مختصرة (يُشغَّل مرة واحدة أثناء المرحلة 3)
import fs from 'node:fs';
import path from 'node:path';

const base = 'src/app/features';
const w = (f, s) => fs.writeFileSync(path.join(base, f), s);
const HEAD_GUARD = `import { permissionGuard } from '@core/guards/permission.guard';\n`;

w('auth/auth.routes.ts', `import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.component').then(m => m.LoginComponent) }
];
`);

w('dashboard/dashboard.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission, DASHBOARD_ACCESS, DEPARTMENT_DASHBOARD_ACCESS, OFFICE_DASHBOARD_ACCESS } from '@core/constants/access';

/** لوحة المتابعة حسب الدور، والتنقل بين لوحات الفرع/القسم/المكتب */
export const DASHBOARD_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard], data: { anyPermission: DASHBOARD_ACCESS }, loadComponent: () => import('./pages/dashboard-home').then(m => m.DashboardHome) },
  { path: 'dashboard/branch/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewBranchDashboard, back: '/' }, loadComponent: () => import('./pages/branch-dashboard').then(m => m.BranchDashboardPage) },
  { path: 'dashboard/department/:id', canActivate: [permissionGuard], data: { anyPermission: DEPARTMENT_DASHBOARD_ACCESS, back: '/' }, loadComponent: () => import('./pages/department-dashboard').then(m => m.DepartmentDashboardPage) },
  { path: 'dashboard/office/:id', canActivate: [permissionGuard], data: { anyPermission: OFFICE_DASHBOARD_ACCESS, back: '/' }, loadComponent: () => import('./pages/office-dashboard').then(m => m.OfficeDashboardPage) }
];
`);

w('work-tasks/work-tasks.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission, WORK_TASK_VIEW } from '@core/constants/access';

/** مهام العمل: صفحة كل مهمة "جاري العمل عليها" حالياً، والإدارة للسوبر ادمن */
export const WORK_TASKS_ROUTES: Routes = [
  { path: 'tasks/:id', canActivate: [permissionGuard], data: { anyPermission: WORK_TASK_VIEW, back: '/' }, loadComponent: () => import('./pages/task-placeholder-page').then(m => m.TaskPlaceholderPage) },
  { path: 'work-tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ViewWorkTasks }, loadComponent: () => import('./pages/work-tasks-page').then(m => m.WorkTasksPage) }
];
`);

w('profile/profile.routes.ts', `import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  { path: 'profile', loadComponent: () => import('./pages/profile-page').then(m => m.ProfilePage) }
];
`);

w('notifications/notifications.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission } from '@core/constants/access';

export const NOTIFICATIONS_ROUTES: Routes = [
  { path: 'notifications', canActivate: [permissionGuard], data: { permission: AppPermission.ViewNotifications }, loadComponent: () => import('./pages/notifications-page').then(m => m.NotificationsPage) }
];
`);

w('task-board/task-board.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission, TASK_ASSIGN } from '@core/constants/access';

/** لوحة المهام المُسندة: تحتاج ViewTaskBoard، والإسناد والمتابعة بصلاحيات AssignTaskTo* / HandleUnitTasks */
export const TASK_BOARD_ROUTES: Routes = [
  { path: 'task-board', canActivate: [permissionGuard], data: { permission: AppPermission.ViewTaskBoard }, loadComponent: () => import('./pages/task-board-page').then(m => m.TaskBoardPage) },
  { path: 'task-board/recurring', canActivate: [permissionGuard], data: { anyPermission: TASK_ASSIGN, back: '/task-board' }, loadComponent: () => import('./pages/recurring-page').then(m => m.RecurringTasksPage) },
  { path: 'task-board/stats', canActivate: [permissionGuard], data: { permission: AppPermission.ViewTaskStats, back: '/task-board' }, loadComponent: () => import('./pages/task-stats-page').then(m => m.TaskStatsPage) }
];
`);

w('todo/todo.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission } from '@core/constants/access';

/** مفكرتي */
export const TODO_ROUTES: Routes = [
  { path: 'todo-lists', canActivate: [permissionGuard], data: { permission: AppPermission.ViewToDoLists }, loadComponent: () => import('./pages/todo-lists-page').then(m => m.TodoListsPage) },
  { path: 'todo-lists/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewToDoLists, back: '/todo-lists' }, loadComponent: () => import('./pages/todo-list-page').then(m => m.TodoListPage) }
];
`);

w('devices/devices.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { DEVICE_ACCESS } from '@core/constants/access';

/** توثيق الأجهزة: الحماية بصلاحيات الدور، ومن يضيف أو يعدّل أو يحذف يرى ما يعمل عليه (AnyDeviceView في الباكاند) */
export const DEVICES_ROUTES: Routes = [
  {
    path: 'devices', canActivate: [permissionGuard], data: { anyPermission: DEVICE_ACCESS },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'installations' },
      { path: 'installations', loadComponent: () => import('./pages/installations-page').then(m => m.InstallationsPage) },
      { path: 'sites', loadComponent: () => import('./pages/sites-page').then(m => m.SitesPage) },
      { path: 'sites/:id', data: { back: '/devices/sites' }, loadComponent: () => import('./pages/site-details-page').then(m => m.SiteDetailsPage) },
      { path: 'catalog', loadComponent: () => import('./pages/devices-catalog-page').then(m => m.DevicesCatalogPage) }
    ]
  }
];
`);

const mp = (path_, perm, file, cls, extra = '') => `      {
        path: '${path_}', canActivate: [permissionGuard], data: { permission: AppPermission.${perm}${extra} },
        loadComponent: () => import('./pages/${file}').then(m => m.${cls})
      }`;
w('maintenance/maintenance.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { AppPermission, MANAGE_MAINTENANCE_LOOKUPS } from '@core/constants/access';

/** صفحة طباعة خارج الإطار العام (بلا سايدبار): إيصال استلام / ورقة تسليم طلب صيانة */
export const MAINTENANCE_PRINT_ROUTES: Routes = [
  {
    path: 'maintenance/print/:id/:kind', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests, back: '/maintenance/requests' },
    loadComponent: () => import('./pages/request-print-page').then(m => m.MaintenancePrintPage)
  }
];

/** الصيانة: طلبات (أجهزة العملاء)، مهام ميدانية، إحصائيات، وإعدادات القوائم — النطاق يحدده الباكاند */
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: 'maintenance',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'requests' },
${[
  mp('requests', 'ViewMaintenanceRequests', 'requests-page', 'MaintenanceRequestsPage'),
  mp('requests/:id', 'ViewMaintenanceRequests', 'request-details-page', 'MaintenanceRequestDetailsPage', ", back: '/maintenance/requests'"),
  mp('mine', 'ViewMyMaintenanceRequests', 'my-requests-page', 'MaintenanceMyRequestsPage'),
  mp('devices', 'ViewMaintenanceDevices', 'devices-page', 'MaintenanceDevicesPage'),
  mp('parts', 'ViewSpareParts', 'spare-parts-page', 'MaintenanceSparePartsPage'),
  mp('parts/report', 'ViewSparePartReports', 'spare-parts-report-page', 'MaintenanceSparePartsReportPage', ", back: '/maintenance/parts'"),
  mp('tasks', 'ViewMaintenanceTasks', 'tasks-page', 'MaintenanceTasksPage'),
  mp('stats', 'ViewMaintenanceStats', 'stats-page', 'MaintenanceStatsPage'),
].join(',\n')},
      {
        path: 'settings', canActivate: [permissionGuard], data: { anyPermission: MANAGE_MAINTENANCE_LOOKUPS },
        loadComponent: () => import('./pages/settings-page').then(m => m.MaintenanceSettingsPage)
      }
    ]
  }
];
`);

w('vacations/vacations.routes.ts', `import { Routes } from '@angular/router';
${HEAD_GUARD}import { APPROVE_VACATIONS, AppPermission, MANAGE_VACATION_TYPES, VACATION_STATS } from '@core/constants/access';

/** نموذج طلب الإجازة الورقي — خارج الإطار العام */
export const VACATION_PRINT_ROUTES: Routes = [
  {
    path: 'vacations/print/:id', canActivate: [permissionGuard], data: { permission: AppPermission.PrintVacation, back: '/profile' },
    loadComponent: () => import('./pages/vacation-print-page').then(m => m.VacationPrintPage)
  }
];

export const VACATIONS_ROUTES: Routes = [
  {
    path: 'vacations/review', canActivate: [permissionGuard], data: { anyPermission: APPROVE_VACATIONS },
    loadComponent: () => import('./pages/vacation-review-page').then(m => m.VacationReviewPage)
  },
  {
    path: 'vacations/stats', canActivate: [permissionGuard], data: { anyPermission: VACATION_STATS },
    loadComponent: () => import('./pages/vacation-stats-page').then(m => m.VacationStatsPage)
  },
  {
    path: 'vacation-types', canActivate: [permissionGuard], data: { anyPermission: MANAGE_VACATION_TYPES },
    loadComponent: () => import('./pages/vacation-types-page').then(m => m.VacationTypesPage)
  },
  {
    path: 'vacations/holidays', canActivate: [permissionGuard], data: { permission: AppPermission.ViewHolidays },
    loadComponent: () => import('./pages/holidays-page').then(m => m.HolidaysPage)
  }
];
`);

const simple = (dir, constName, pathName, data, importLine, file, cls, comment) => w(`${dir}/${dir}.routes.ts`, `import { Routes } from '@angular/router';
${HEAD_GUARD}${importLine}

/** ${comment} */
export const ${constName}: Routes = [
  { path: '${pathName}', canActivate: [permissionGuard], data: ${data}, loadComponent: () => import('./pages/${file}').then(m => m.${cls}) }
];
`);
const AP = "import { AppPermission } from '@core/constants/access';";
const note = 'الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته';
simple('branches', 'BRANCHES_ROUTES', 'branches', '{ permission: AppPermission.ViewBranches }', AP, 'branches-page', 'BranchesPage', note);
simple('departments', 'DEPARTMENTS_ROUTES', 'departments', '{ anyPermission: MANAGE_DEPARTMENTS }', "import { MANAGE_DEPARTMENTS } from '@core/constants/access';", 'departments-page', 'DepartmentsPage', note);
simple('offices', 'OFFICES_ROUTES', 'offices', '{ permission: AppPermission.ViewOffices }', AP, 'offices-page', 'OfficesPage', note);
simple('users', 'USERS_ROUTES', 'users', '{ permission: AppPermission.ViewUsers }', AP, 'users-page', 'UsersPage', note);
simple('roles', 'ROLES_ROUTES', 'roles', '{ permission: AppPermission.ViewRoles }', AP, 'roles-page', 'RolesPage', note);

// app.routes.ts
fs.writeFileSync('src/app/app.routes.ts', `import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { MainLayout } from '@features/layout';
import { AUTH_ROUTES } from '@features/auth/auth.routes';
import { BRANCHES_ROUTES } from '@features/branches/branches.routes';
import { DASHBOARD_ROUTES } from '@features/dashboard/dashboard.routes';
import { DEPARTMENTS_ROUTES } from '@features/departments/departments.routes';
import { DEVICES_ROUTES } from '@features/devices/devices.routes';
import { MAINTENANCE_PRINT_ROUTES, MAINTENANCE_ROUTES } from '@features/maintenance/maintenance.routes';
import { NOTIFICATIONS_ROUTES } from '@features/notifications/notifications.routes';
import { OFFICES_ROUTES } from '@features/offices/offices.routes';
import { PROFILE_ROUTES } from '@features/profile/profile.routes';
import { ROLES_ROUTES } from '@features/roles/roles.routes';
import { TASK_BOARD_ROUTES } from '@features/task-board/task-board.routes';
import { TODO_ROUTES } from '@features/todo/todo.routes';
import { USERS_ROUTES } from '@features/users/users.routes';
import { VACATIONS_ROUTES, VACATION_PRINT_ROUTES } from '@features/vacations/vacations.routes';
import { WORK_TASKS_ROUTES } from '@features/work-tasks/work-tasks.routes';

/**
 * تعريف المسارات موزّع على الميزات (<feature>.routes.ts)؛ كل صفحة تُحمَّل عند فتحها فقط (loadComponent)،
 * وباقي الصفحات تُحمَّل مسبقاً في الخلفية بعد أول عرض (PreloadAllModules في app.config).
 * الـ guards هنا للواجهة فقط؛ الباكاند يتحقق من كل صلاحية ونطاق بنفسه.
 */
export const routes: Routes = [
  ...AUTH_ROUTES,
  // صفحات الطباعة خارج الإطار العام (بلا سايدبار)
  ...MAINTENANCE_PRINT_ROUTES,
  ...VACATION_PRINT_ROUTES,
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      ...DASHBOARD_ROUTES,
      ...WORK_TASKS_ROUTES,
      ...PROFILE_ROUTES,
      ...NOTIFICATIONS_ROUTES,
      ...TASK_BOARD_ROUTES,
      ...TODO_ROUTES,
      ...DEVICES_ROUTES,
      ...MAINTENANCE_ROUTES,
      ...VACATIONS_ROUTES,
      // إدارة الهيكل والمستخدمين
      ...BRANCHES_ROUTES,
      ...DEPARTMENTS_ROUTES,
      ...OFFICES_ROUTES,
      ...USERS_ROUTES,
      ...ROLES_ROUTES
    ]
  },
  { path: '**', redirectTo: 'login' }
];
`);
console.log('routes generated');
