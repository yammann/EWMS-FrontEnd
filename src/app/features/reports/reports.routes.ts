import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, REPORT_ACCESS } from '@core/constants/access';

/** طباعة تقرير A4 — خارج الإطار العام */
export const REPORT_PRINT_ROUTES: Routes = [
  {
    path: 'reports/print/:key', canActivate: [permissionGuard], data: { anyPermission: REPORT_ACCESS, back: '/reports', noPreload: true },
    loadComponent: () => import('./pages/report-print-page').then(m => m.ReportPrintPage)
  }
];

/** مركز التقارير: الصفحات لمن يملك صلاحية سحب أي تقرير؛ صلاحية كل تقرير وحدوده يفحصها الخادم */
export const REPORTS_ROUTES: Routes = [
  {
    path: 'reports', canActivate: [permissionGuard], data: { anyPermission: REPORT_ACCESS },
    loadComponent: () => import('./pages/reports-page').then(m => m.ReportsPage)
  },
  {
    path: 'reports/log', canActivate: [permissionGuard], data: { permission: AppPermission.ViewReportLog },
    loadComponent: () => import('./pages/report-log-page').then(m => m.ReportLogPage)
  },
  {
    path: 'reports/:key', canActivate: [permissionGuard], data: { anyPermission: REPORT_ACCESS, back: '/reports' },
    loadComponent: () => import('./pages/report-page').then(m => m.ReportPage)
  }
];
