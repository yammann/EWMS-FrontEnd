import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  const permission = route.data['permission'] as string | undefined;
  const allowed = permission ? auth.hasPermission(permission) : auth.canReviewVacations();
  return allowed || router.createUrlTree(['/profile']);
};
