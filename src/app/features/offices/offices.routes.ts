import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

/** الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته */
export const OFFICES_ROUTES: Routes = [
  { path: 'offices', canActivate: [permissionGuard], data: { permission: AppPermission.ViewOffices }, loadComponent: () => import('./pages/offices-page').then(m => m.OfficesPage) }
];
