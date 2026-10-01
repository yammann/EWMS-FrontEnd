import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppPermissionName } from '../constants/access';

export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  const permission = route.data['permission'] as AppPermissionName | undefined;
  // data.roles: صفحات حسب الدور (مثل إحصائيات الإجازات للرؤساء) — الباكاند يتحقق من النطاق أيضاً
  const roles = route.data['roles'] as readonly string[] | undefined;
  // data.anyPermission: تكفي واحدة من عدة صلاحيات (مثل إعدادات الصيانة: إضافة أو تعديل أو حذف)
  const anyPermission = route.data['anyPermission'] as readonly AppPermissionName[] | undefined;
  // الدور والصلاحية معاً إن حُدّدا (مثل إحصائيات الإجازات: رئيس + خدمة الإجازات مُسندة لوحدته)
  const roleOk = !roles || auth.hasRole(...roles);
  const permissionOk = anyPermission ? auth.hasAnyPermission(anyPermission)
    : permission ? auth.hasPermission(permission)
      : !!roles || auth.canReviewVacations();
  const allowed = roleOk && permissionOk;
  return allowed || router.createUrlTree(['/profile']);
};
