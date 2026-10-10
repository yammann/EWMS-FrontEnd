import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

/** الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته */
export const ROLES_ROUTES: Routes = [
  { path: 'roles', canActivate: [permissionGuard], data: { permission: AppPermission.ViewRoles }, loadComponent: () => import('./pages/roles-page').then(m => m.RolesPage) }
];
