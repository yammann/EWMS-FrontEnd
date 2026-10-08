import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`)
      .pipe(catchError(this.handleError));
  }

  /** ملف (مرفق) كـ Blob — يمر بمعترض رمز الدخول كبقية الطلبات */
  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
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

    return throwError(() => ({ status: error.status, message }));
  }
}
