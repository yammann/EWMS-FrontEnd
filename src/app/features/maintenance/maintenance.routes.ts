import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, MANAGE_MAINTENANCE_LOOKUPS } from '@core/constants/access';

/** صفحة طباعة خارج الإطار العام (بلا سايدبار): إيصال استلام / ورقة تسليم طلب صيانة */
export const MAINTENANCE_PRINT_ROUTES: Routes = [
  {
    path: 'maintenance/print/:id/:kind', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests, back: '/maintenance/requests', noPreload: true },
    loadComponent: () => import('./pages/request-print-page').then(m => m.MaintenancePrintPage)
  }
];

/** الصيانة: طلبات (أجهزة العملاء)، مهام ميدانية، إحصائيات، وإعدادات القوائم — النطاق يحدده الباكاند */
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: 'maintenance',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'requests' },
      {
        path: 'requests', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests },
        loadComponent: () => import('./pages/requests-page').then(m => m.MaintenanceRequestsPage)
      },
      {
        path: 'requests/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceRequests, back: '/maintenance/requests' },
        loadComponent: () => import('./pages/request-details-page').then(m => m.MaintenanceRequestDetailsPage)
      },
      {
        path: 'mine', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMyMaintenanceRequests },
        loadComponent: () => import('./pages/my-requests-page').then(m => m.MaintenanceMyRequestsPage)
      },
      {
        path: 'devices', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceDevices },
        loadComponent: () => import('./pages/devices-page').then(m => m.MaintenanceDevicesPage)
      },
      {
        path: 'parts', canActivate: [permissionGuard], data: { permission: AppPermission.ViewSpareParts },
        loadComponent: () => import('./pages/spare-parts-page').then(m => m.MaintenanceSparePartsPage)
      },
      {
        path: 'parts/report', canActivate: [permissionGuard], data: { permission: AppPermission.ViewSparePartReports, back: '/maintenance/parts' },
        loadComponent: () => import('./pages/spare-parts-report-page').then(m => m.MaintenanceSparePartsReportPage)
      },
      {
        path: 'tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceTasks },
        loadComponent: () => import('./pages/tasks-page').then(m => m.MaintenanceTasksPage)
      },
      {
        path: 'stats', canActivate: [permissionGuard], data: { permission: AppPermission.ViewMaintenanceStats },
        loadComponent: () => import('./pages/stats-page').then(m => m.MaintenanceStatsPage)
      },
      {
        path: 'settings', canActivate: [permissionGuard], data: { anyPermission: MANAGE_MAINTENANCE_LOOKUPS },
        loadComponent: () => import('./pages/settings-page').then(m => m.MaintenanceSettingsPage)
      }
    ]
  }
];
