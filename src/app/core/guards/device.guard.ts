import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DeviceService } from '../services/device.service';

/** صفحات توثيق الأجهزة: لمن يشاهد (قسم العمليات أو ViewDevices) — الباكاند يتحقق أيضاً */
export const deviceGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(AuthService).isAuthenticated()) return router.createUrlTree(['/login']);
  return inject(DeviceService).loadAccess().pipe(map(a => a.canView || router.createUrlTree(['/'])));
};
