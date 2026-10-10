import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '@core/http/api-error';

/**
 * معترض واحد لكل أخطاء /api: يحوّلها إلى ApiError ({status, message}) ليعرضها أي مكوّن بلا تكرار.
 * يوضع بعد jwtInterceptor في المصفوفة كي يرى الأخطاء الخام أولاً (jwt يقرأ status فقط فيعمل على الشكلين).
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError(error => throwError(() => req.url.startsWith('/api/') && error instanceof HttpErrorResponse ? toApiError(error) : error)));
