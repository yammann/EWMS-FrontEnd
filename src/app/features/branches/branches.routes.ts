import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

/** الصفحة تُفتح بصلاحية العرض، وأزرار الإضافة/التعديل/الحذف كلٌّ بصلاحيته */
export const BRANCHES_ROUTES: Routes = [
  { path: 'branches', canActivate: [permissionGuard], data: { permission: AppPermission.ViewBranches }, loadComponent: () => import('./pages/branches-page').then(m => m.BranchesPage) }
];
