import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  const permission = route.data['permission'] as string | undefined;
  // data.roles: صفحات حسب الدور (مثل إحصائيات الإجازات للرؤساء) — الباكاند يتحقق من النطاق أيضاً
  const roles = route.data['roles'] as string[] | undefined;
  const allowed = roles ? roles.includes(auth.currentUser()?.role ?? '')
    : permission ? auth.hasPermission(permission) : auth.canReviewVacations();
  return allowed || router.createUrlTree(['/profile']);
};
