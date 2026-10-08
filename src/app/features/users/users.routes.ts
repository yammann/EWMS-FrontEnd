import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

/** الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته */
export const USERS_ROUTES: Routes = [
  { path: 'users', canActivate: [permissionGuard], data: { permission: AppPermission.ViewUsers }, loadComponent: () => import('./pages/users-page').then(m => m.UsersPage) }
];
