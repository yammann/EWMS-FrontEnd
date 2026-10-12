import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { toApiError } from '@core/http/api-error';

/**
 * معترض واحد لكل أخطاء /api: يحوّلها إلى ApiError ({status, message}) ليعرضها أي مكوّن بلا تكرار.
 * يوضع بعد jwtInterceptor في المصفوفة كي يرى الأخطاء الخام أولاً (jwt يقرأ status فقط فيعمل على الشكلين).
 * طلبات الملفات (responseType: 'blob') يصل خطؤها Blob: تُقرأ رسالته JSON أولاً كي لا تضيع («ضيّق الفلاتر» مثلاً).
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError(error => {
    if (!req.url.startsWith('/api/') || !(error instanceof HttpErrorResponse)) return throwError(() => error);
    if (error.error instanceof Blob && error.error.type.includes('json'))
      return from(error.error.text()).pipe(switchMap(text => {
        let body: unknown = null;
        try { body = JSON.parse(text); } catch { /* ليس JSON: تبقى الرسالة العامة */ }
        return throwError(() => toApiError(new HttpErrorResponse({ error: body, status: error.status, statusText: error.statusText })));
      }));
    return throwError(() => toApiError(error));
  }));
