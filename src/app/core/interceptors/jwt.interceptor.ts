import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const isApi = req.url.startsWith('/api/');
  if (token && isApi) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(catchError(error => {
    if (isApi && token && error.status === 401 && !req.url.endsWith('/Auth/login')) {
      auth.clearSession();
    }
    return throwError(() => error);
  }));
};
