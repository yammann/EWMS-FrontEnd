import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, DASHBOARD_ACCESS, DEPARTMENT_DASHBOARD_ACCESS, OFFICE_DASHBOARD_ACCESS } from '@core/constants/access';

/** لوحة المتابعة حسب الدور، والتنقل بين لوحات الفرع/القسم/المكتب */
export const DASHBOARD_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard], data: { anyPermission: DASHBOARD_ACCESS }, loadComponent: () => import('./pages/dashboard-home').then(m => m.DashboardHome) },
  { path: 'dashboard/branch/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewBranchDashboard, back: '/' }, loadComponent: () => import('./pages/branch-dashboard').then(m => m.BranchDashboardPage) },
  { path: 'dashboard/department/:id', canActivate: [permissionGuard], data: { anyPermission: DEPARTMENT_DASHBOARD_ACCESS, back: '/' }, loadComponent: () => import('./pages/department-dashboard').then(m => m.DepartmentDashboardPage) },
  { path: 'dashboard/office/:id', canActivate: [permissionGuard], data: { anyPermission: OFFICE_DASHBOARD_ACCESS, back: '/' }, loadComponent: () => import('./pages/office-dashboard').then(m => m.OfficeDashboardPage) }
];
