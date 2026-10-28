import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { DIWAN_ACCESS, MANAGE_DIWAN_LOOKUPS } from '@core/constants/access';

/** الكتاب الصادر المعتمد — خارج الإطار العام (ورقة A4). الحدّ على المعاملة يطبّقه الخادم. */
export const DIWAN_PRINT_ROUTES: Routes = [
  {
    path: 'diwan/print/:id', canActivate: [permissionGuard], data: { anyPermission: DIWAN_ACCESS, back: '/diwan', noPreload: true },
    loadComponent: () => import('./pages/correspondence-print-page').then(m => m.CorrespondencePrintPage)
  }
];

/**
 * الديوان: القائمة والمعاملة بصلاحيات الديوان (AnyCorrespondenceView) والإعدادات بصلاحيات الأنواع والحالات.
 * `settings` يسبق `:id` كي لا يُقرأ كرقم معاملة.
 */
export const DIWAN_ROUTES: Routes = [
  {
    path: 'diwan',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: DIWAN_ACCESS }, loadComponent: () => import('./pages/diwan-page').then(m => m.DiwanPage) },
      { path: 'settings', canActivate: [permissionGuard], data: { anyPermission: MANAGE_DIWAN_LOOKUPS, back: '/diwan' }, loadComponent: () => import('./pages/diwan-settings-page').then(m => m.DiwanSettingsPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: DIWAN_ACCESS, back: '/diwan' }, loadComponent: () => import('./pages/correspondence-page').then(m => m.CorrespondencePage) }
    ]
  }
];
