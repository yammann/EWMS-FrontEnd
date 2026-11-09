import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';

/**
 * خريطة مثبّتة في رأس الصفحة تنغلق تدريجياً بينما تنزلق الصفحة فوقها (لوحة المتابعة وصفحة الموقع):
 * ما يُمرَّر بالسمة `pinned` يلتصق تحت النافبار (الخريطة وعنوانها)، وبقية المحتوى هو «الصفحة» المنزلقة فوقها.
 * أثناء السكرول تصغر الخريطة وتخفت حسب `--p` (0 مفتوحة ← 1 مغلقة)؛ يُكتب كمتغير CSS بلا إعادة رسم Angular.
 * `hasPinned = false`: بلا خريطة (موقع بلا إحداثيات) فتُعرض الصفحة عادية بلا حافة منزلقة.
 */
@Component({
  selector: 'app-pinned-map',
  standalone: true,
  template: `
    <div #pinned class="map-pinned"><ng-content select="[pinned]" /></div>
    <div #sheet class="map-sheet" [class.flat]="!hasPinned()"><ng-content /></div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    /* الجزء المثبّت: يلتصق تحت النافبار، وينغلق حسب --p */
    .map-pinned {
      --p: 0;
      position: sticky;
      top: var(--topbar-h, 64px);
      z-index: 0;
      display: grid;
      gap: 10px;
      padding-top: 6px;
      transform-origin: top center;
      transform: scale(calc(1 - .1 * var(--p)));
      opacity: calc(1 - .95 * var(--p));
      will-change: transform, opacity;
    }
    .map-pinned.closing { pointer-events: none; }
    /* الصفحة المنزلقة فوق الخريطة: خلفية الصفحة نفسها مع حافة علوية مستديرة وظل خفيف.
       الهامش السالب يغطي حشوة .page الجانبية حتى لا تظهر الخريطة من الجانبين */
    .map-sheet {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 20px;
      margin: 18px calc(-1 * var(--page-pad-x, 28px)) 0;
      padding: 22px var(--page-pad-x, 28px) 0;
      background: var(--page-bg);
      border-radius: 26px 26px 0 0;
      box-shadow: 0 -10px 28px rgba(0, 0, 0, .06);
    }
    .map-sheet.flat { margin: 0; padding: 0; background: none; border-radius: 0; box-shadow: none; }
    @media (max-width: 760px) { .map-sheet { gap: 16px; } }
    @media (prefers-reduced-motion: reduce) { .map-pinned { transform: none; } }
  `]
})
export class PinnedMap {
  private destroyRef = inject(DestroyRef);
  private pinned = viewChild<ElementRef<HTMLElement>>('pinned');
  private sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  hasPinned = input(true);

  constructor() { afterNextRender(() => this.trackCollapse()); }

  /** مقدار انغلاق الخريطة (0 → 1) = نسبة ما غطّته الصفحة المنزلقة منها */
  private trackCollapse() {
    let frame = 0;
    const update = () => {
      frame = 0;
      const pin = this.pinned()?.nativeElement; const sheet = this.sheet()?.nativeElement;
      if (!pin || !sheet || !pin.offsetHeight) return;
      // التصغير حول الحافة العليا لا يغيّر top، وoffsetHeight لا يتأثر بالـ transform — فلا توجد حلقة تغذية راجعة
      const covered = pin.getBoundingClientRect().top + pin.offsetHeight - sheet.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, covered / pin.offsetHeight));
      pin.style.setProperty('--p', p.toFixed(3));
      pin.classList.toggle('closing', p > .35);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    update();
    this.destroyRef.onDestroy(() => {
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    });
  }
}
