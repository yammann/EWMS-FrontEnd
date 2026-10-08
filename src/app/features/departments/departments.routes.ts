import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { MANAGE_DEPARTMENTS } from '@core/constants/access';

/** الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته */
export const DEPARTMENTS_ROUTES: Routes = [
  { path: 'departments', canActivate: [permissionGuard], data: { anyPermission: MANAGE_DEPARTMENTS }, loadComponent: () => import('./pages/departments-page').then(m => m.DepartmentsPage) }
];
