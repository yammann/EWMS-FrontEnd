import { Injectable, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * سجل التنقل داخل التطبيق + وجهة «رجوع» الاحتياطية.
 * كل مسار فرعي/تفصيلي يعلن أبَه بـ `data: { back: '/المسار' }`؛ زر الرجوع الموحّد (app-back-button) يرجع للصفحة السابقة
 * في التطبيق إن وُجدت، وإلا ينتقل إلى هذه الوجهة (مثلاً حين تُفتح الصفحة برابط مباشر).
 */
@Injectable({ providedIn: 'root' })
export class NavHistory {
  private router = inject(Router);
  private location = inject(Location);
  private navigations = 0;

  /** وجهة الرجوع الاحتياطية للمسار الحالي (null = الصفحة رئيسية ولا زر رجوع) */
  readonly fallback = signal<string | null>(null);

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.navigations++;
      this.fallback.set(this.deepestBack(this.router.routerState.snapshot.root));
    });
  }

  /** رجوع للصفحة السابقة داخل التطبيق، أو للوجهة الاحتياطية */
  back(fallback?: string | null) {
    if (this.navigations > 1) this.location.back();
    else this.router.navigateByUrl(fallback ?? this.fallback() ?? '/');
  }

  private deepestBack(route: ActivatedRouteSnapshot): string | null {
    let found: string | null = null;
    for (let r: ActivatedRouteSnapshot | null = route; r; r = r.firstChild) {
      const b = r.data['back'];
      if (typeof b === 'string') found = b;
    }
    return found;
  }
}
