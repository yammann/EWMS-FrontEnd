import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { PermissionPreloadStrategy } from '@core/routing/permission-preload.strategy';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { jwtInterceptor } from '@core/interceptors/jwt.interceptor';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // الصفحات تُحمَّل عند الطلب، ثم تُجلب في الخلفية الصفحاتُ المسموحة للمستخدم فقط (تنقّل فوري بلا إهدار نطاق)
    provideRouter(routes, withPreloading(PermissionPreloadStrategy)),
    provideHttpClient(withInterceptors([jwtInterceptor, apiErrorInterceptor]))
  ]
};
