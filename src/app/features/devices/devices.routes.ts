import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { DEVICE_ACCESS } from '@core/constants/access';

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
