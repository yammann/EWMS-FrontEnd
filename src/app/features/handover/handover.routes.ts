import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { HANDOVER_ACCESS } from '@core/constants/access';

/** الاستلام والتسليم: القائمة والمحضر بصلاحيات الاستلام (AnyHandoverView). الحدّ على كل محضر يطبّقه الخادم. */
export const HANDOVER_ROUTES: Routes = [
  {
    path: 'handovers',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: HANDOVER_ACCESS }, loadComponent: () => import('./pages/handovers-page').then(m => m.HandoversPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: HANDOVER_ACCESS, back: '/handovers' }, loadComponent: () => import('./pages/handover-page').then(m => m.HandoverPage) }
    ]
  }
];
