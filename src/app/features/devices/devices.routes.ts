import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { DEVICE_ACCESS, SITE_ACCESS } from '@core/constants/access';

/**
 * توثيق الأجهزة وسجل المواقع: الحماية بصلاحيات الدور. التركيبات والكتالوج بصلاحيات الأجهزة (AnyDeviceView)،
 * والمواقع سجل مشترك بصلاحياتها أو لمن يوثّق الأجهزة (AnySiteView). العناوين بقيت كما هي كي لا تنكسر الروابط.
 */
export const DEVICES_ROUTES: Routes = [
  {
    path: 'devices',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'installations' },
      { path: 'installations', canActivate: [permissionGuard], data: { anyPermission: DEVICE_ACCESS }, loadComponent: () => import('./pages/installations-page').then(m => m.InstallationsPage) },
      { path: 'sites', canActivate: [permissionGuard], data: { anyPermission: SITE_ACCESS }, loadComponent: () => import('./pages/sites-page').then(m => m.SitesPage) },
      { path: 'sites/:id', canActivate: [permissionGuard], data: { anyPermission: SITE_ACCESS, back: '/devices/sites' }, loadComponent: () => import('./pages/site-details-page').then(m => m.SiteDetailsPage) },
      { path: 'catalog', canActivate: [permissionGuard], data: { anyPermission: DEVICE_ACCESS }, loadComponent: () => import('./pages/devices-catalog-page').then(m => m.DevicesCatalogPage) }
    ]
  }
];
