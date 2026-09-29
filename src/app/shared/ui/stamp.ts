import { Component, Injectable, computed, inject, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

/** معالم الطوابع (من ملفات الهوية) — رمز المحافظة كما في syria-governorates.geojson */
export const STAMP_LANDMARKS: Readonly<Record<string, { ar: string; en: string }>> = {
  SY01: { ar: 'السيف الدمشقي', en: 'Damascus Sword' },
  SY02: { ar: 'قلعة حلب', en: 'Citadel of Aleppo' },
  SY03: { ar: 'غوطة ريف دمشق', en: 'Al-Ghouta' },
  SY04: { ar: 'ساعة حمص', en: 'Homs Clock Tower' },
  SY05: { ar: 'نواعير حماة', en: 'Hama Waterwheels' },
  SY06: { ar: 'قوس النصر', en: 'Arch of Triumph' },
  SY07: { ar: 'رويحة', en: 'Al-Ruwayha' },
  SY08: { ar: 'عين ديوار', en: 'Ain Diwar' },
  SY09: { ar: 'الجسر المعلق', en: 'Suspension Bridge' },
  SY10: { ar: 'جزيرة أرواد', en: 'Arwad Island' },
  SY11: { ar: 'بوابة بغداد', en: 'Baghdad Gate' },
  SY12: { ar: 'المسجد العمري', en: 'Al-Omari Mosque' },
  SY13: { ar: 'قنوات', en: 'Qanawat Ruins' },
  SY14: { ar: 'بيت صيدا', en: 'Saida Home' }
};

export type StampVariant = 'framed' | 'plain';

/**
 * يحمّل ملف الطابع (public/stamps/{variant}/{code}.svg) مرة واحدة ويخزّنه.
 * الملفات مُعدّة مسبقاً (سكربت الطوابع): الحبر currentColor والورق var(--stamp-paper) — فتتلوّن بالثيم.
 */
@Injectable({ providedIn: 'root' })
export class StampService {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private cache = new Map<string, Observable<SafeHtml | null>>();

  get(code: string, variant: StampVariant): Observable<SafeHtml | null> {
    const key = `${variant}/${code}`;
    if (!STAMP_LANDMARKS[code]) return of(null);
    let stamp$ = this.cache.get(key);
    if (!stamp$) {
      stamp$ = this.http.get(`stamps/${key}.svg`, { responseType: 'text' }).pipe(
        // ملفاتنا المحلية الموثوقة (بلا سكربتات) — تُدرج كما هي حتى يعمل currentColor
        map(svg => this.sanitizer.bypassSecurityTrustHtml(svg)),
        catchError(() => of(null)),
        shareReplay(1)
      );
      this.cache.set(key, stamp$);
    }
    return stamp$;
  }
}

/**
 * طابع المحافظة: `<app-stamp code="SY02" />` — اللون من CSS color (افتراضياً لون الثيم)،
 * والورق من --stamp-paper. الحجم من CSS للعنصر (width).
 */
@Component({
  selector: 'app-stamp', standalone: true,
  template: `@if (svg(); as s) { <span class="art" [innerHTML]="s"></span> }`,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  styles: [`
    :host { display: inline-block; color: var(--brand-600); --stamp-paper: var(--surface); line-height: 0; }
    /* الـ viewBox مقصوص على حدود الرسم: المؤطَّر عمودي (316×440)، وغير المؤطَّر بنسبة رسمه */
    .art, .art ::ng-deep svg { display: block; width: 100%; height: auto; }
  `]
})
export class Stamp {
  code = input.required<string>();
  variant = input<StampVariant>('framed');

  private service = inject(StampService);
  private key = computed(() => ({ code: this.code(), variant: this.variant() }));
  protected svg = toSignal(toObservable(this.key).pipe(switchMap(k => this.service.get(k.code, k.variant))), { initialValue: null });
  protected label = computed(() => {
    const landmark = STAMP_LANDMARKS[this.code()];
    return landmark ? `طابع ${landmark.ar}` : '';
  });
}
