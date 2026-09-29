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
  const allowed = roles ? auth.hasRole(...roles)
    : permission ? auth.hasPermission(permission) : auth.canReviewVacations();
  return allowed || router.createUrlTree(['/profile']);
};
