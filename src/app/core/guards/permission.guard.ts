import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AppPermissionName } from '@core/constants/access';

/**
 * حماية الصفحات بصلاحيات الدور فقط (Role-Permission، 2026-10-03) — لا أسماء أدوار ولا مناصب.
 * data.permission: صلاحية واحدة. data.anyPermission: تكفي واحدة من عدة صلاحيات
 * (مثل مراجعة الإجازات: الموافقة الأولى أو الاعتماد النهائي). الباكاند يطبّق حدّ كل صلاحية على السجلات.
 */
export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  const permission = route.data['permission'] as AppPermissionName | undefined;
  const anyPermission = route.data['anyPermission'] as readonly AppPermissionName[] | undefined;
  const allowed = anyPermission ? auth.hasAnyPermission(anyPermission)
    : permission ? auth.hasPermission(permission)
      : false;
  return allowed || router.createUrlTree(['/profile']);
};
