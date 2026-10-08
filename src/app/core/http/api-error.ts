import { HttpErrorResponse } from '@angular/common/http';

/** الشكل الموحّد لأخطاء الـ API في كل التطبيق: رسالة عربية جاهزة للعرض + رمز الحالة */
export interface ApiError { status: number; message: string; }

/** يحوّل رد خطأ HTTP إلى ApiError (رسائل الباكاند العربية تُعرض كما هي) */
export function toApiError(error: HttpErrorResponse): ApiError {
  let message = 'حدث خطأ غير متوقع';

  if (error.status === 0) {
    message = 'لا يمكن الاتصال بالخادم';
  } else if (error.status === 400 && error.error?.errors) {
    const errors = error.error.errors;
    const details = Array.isArray(errors)
      ? errors.map((item: { message?: string }) => item.message).filter(Boolean)
      : Object.values(errors).flat();
    message = details.join('، ') || error.error.message || 'بيانات غير صحيحة';
  } else if (error.error?.message) {
    message = error.error.message;
  } else if (error.error?.title) {
    message = error.error.title;
  } else if (error.status === 401) {
    message = 'بيانات الدخول غير صحيحة';
  } else if (error.status === 403) {
    message = 'ليس لديك صلاحية للوصول';
  }

  return { status: error.status, message };
}
