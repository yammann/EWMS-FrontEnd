import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { deviceGuard } from './core/guards/device.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AppPermission, LEADER_ROLES } from './core/constants/access';
import { MainLayout } from './features/layout/main-layout';

/**
 * كل صفحة تُحمَّل عند فتحها فقط (loadComponent) — الحزمة الأولى تحتوي الإطار العام وصفحة الدخول فقط،
 * وباقي الصفحات تُحمَّل مسبقاً في الخلفية بعد أول عرض (PreloadAllModules في app.config).
 * الـ guards هنا للواجهة فقط؛ الباكاند يتحقق من كل صلاحية ونطاق بنفسه.
 */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // لوحة المتابعة حسب الدور، والتنقل بين لوحات الفرع/القسم/المكتب
      { path: '', loadComponent: () => import('./features/dashboard/dashboard-home').then(m => m.DashboardHome) },
      { path: 'dashboard/branch/:id', loadComponent: () => import('./features/dashboard/branch-dashboard').then(m => m.BranchDashboardPage) },
      { path: 'dashboard/department/:id', loadComponent: () => import('./features/dashboard/department-dashboard').then(m => m.DepartmentDashboardPage) },
      { path: 'dashboard/office/:id', loadComponent: () => import('./features/dashboard/office-dashboard').then(m => m.OfficeDashboardPage) },

      // مهام العمل: صفحة كل مهمة "جاري العمل عليها" حالياً، والإدارة للسوبر ادمن
      { path: 'tasks/:id', loadComponent: () => import('./features/work-tasks/task-placeholder-page').then(m => m.TaskPlaceholderPage) },
      {
        path: 'work-tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ManageWorkTasks },
        loadComponent: () => import('./features/work-tasks/work-tasks-page').then(m => m.WorkTasksPage)
      },

      { path: 'profile', loadComponent: () => import('./features/profile/profile-page').then(m => m.ProfilePage) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications-page').then(m => m.NotificationsPage) },
      // لوحة المهام المُسندة (الموظف يستقبل، والرؤساء يُسندون ويتابعون)
      { path: 'task-board', loadComponent: () => import('./features/task-board/task-board-page').then(m => m.TaskBoardPage) },

      // توثيق الأجهزة — قسم العمليات في الفرع التقني (المشاهدة لموظفيه، الإدارة لرئيسه)
      {
        path: 'devices', canActivateChild: [deviceGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'installations' },
          { path: 'installations', loadComponent: () => import('./features/devices/installations-page').then(m => m.InstallationsPage) },
          { path: 'regions', loadComponent: () => import('./features/devices/regions-page').then(m => m.RegionsPage) },
          { path: 'sites', loadComponent: () => import('./features/devices/sites-page').then(m => m.SitesPage) },
          { path: 'sites/:id', loadComponent: () => import('./features/devices/site-details-page').then(m => m.SiteDetailsPage) },
          { path: 'catalog', loadComponent: () => import('./features/devices/devices-catalog-page').then(m => m.DevicesCatalogPage) }
        ]
      },

      // الإجازات
      {
        path: 'vacations/review', canActivate: [permissionGuard], data: { permission: AppPermission.ApproveVacation },
        loadComponent: () => import('./features/vacations/vacation-review-page').then(m => m.VacationReviewPage)
      },
      {
        path: 'vacations/stats', canActivate: [permissionGuard], data: { roles: LEADER_ROLES },
        loadComponent: () => import('./features/vacations/vacation-stats-page').then(m => m.VacationStatsPage)
      },
      {
        path: 'vacation-types', canActivate: [permissionGuard], data: { permission: AppPermission.ManageVacationTypes },
        loadComponent: () => import('./features/vacations/vacation-types-page').then(m => m.VacationTypesPage)
      },

      // إدارة الهيكل والمستخدمين (للسوبر ادمن حالياً)
      {
        path: 'branches', canActivate: [permissionGuard], data: { permission: AppPermission.ManageBranches },
        loadComponent: () => import('./features/branches/branches-page').then(m => m.BranchesPage)
      },
      {
        path: 'departments', canActivate: [permissionGuard], data: { permission: AppPermission.ManageDepartments },
        loadComponent: () => import('./features/departments/departments-page').then(m => m.DepartmentsPage)
      },
      {
        path: 'offices', canActivate: [permissionGuard], data: { permission: AppPermission.ManageOffices },
        loadComponent: () => import('./features/offices/offices-page').then(m => m.OfficesPage)
      },
      {
        path: 'users', canActivate: [permissionGuard], data: { permission: AppPermission.ManageUsers },
        loadComponent: () => import('./features/users/users-page').then(m => m.UsersPage)
      },
      {
        path: 'roles', canActivate: [permissionGuard], data: { permission: AppPermission.ManageRoles },
        loadComponent: () => import('./features/roles/roles-page').then(m => m.RolesPage)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
