import { Injectable, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, mergeMap, of, timer } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { AppPermissionName } from '@core/constants/access';

/** مهلة بعد التنقل قبل بدء التحميل المسبق — لا نزاحم عرض الصفحة الحالية */
const PRELOAD_DELAY_MS = 1500;

/**
 * تحميل مسبق ذكي للصفحات: يجلب في الخلفية فقط الصفحات التي يملك المستخدم صلاحية فتحها (data.permission / data.anyPermission)،
 * بدل PreloadAllModules الذي كان يجلب كل الصفحات حتى غير المسموحة. ويعاد التقييم عند كل تنقل (فبعد الدخول تبدأ الصفحات المسموحة بالتحميل).
 * مسار `data.noPreload` لا يُحمَّل مسبقاً (صفحات الطباعة).
 */
@Injectable({ providedIn: 'root' })
export class PermissionPreloadStrategy implements PreloadingStrategy {
  private auth = inject(AuthService);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const data = route.data ?? {};
    if (data['noPreload'] || !this.auth.currentUser()) return of(null);
    const one = data['permission'] as AppPermissionName | undefined;
    const any = data['anyPermission'] as readonly AppPermissionName[] | undefined;
    const allowed = one ? this.auth.hasPermission(one) : any ? this.auth.hasAnyPermission(any) : true;
    return allowed ? timer(PRELOAD_DELAY_MS).pipe(mergeMap(() => load())) : of(null);
  }
}
