import { Component, computed, inject, input } from '@angular/core';
import { NavHistory } from '@core/services/nav-history.service';
import { Icon } from '@shared/ui/icon';

/**
 * زر «رجوع» الموحّد — مكان واحد ثابت: أول عنصر في الشريط العلوي للتخطيط، وأول زر في شريط صفحات الطباعة.
 * يظهر فقط في المسارات التي تعلن `data.back` (أو عند تمرير `fallback`).
 */
@Component({
  selector: 'app-back-button', standalone: true, imports: [Icon],
  template: `
    @if (target(); as t) {
      <button type="button" class="back-btn" (click)="nav.back(t)" aria-label="رجوع"><app-icon name="back" /><span>رجوع</span></button>
    }`,
  styles: [`
    :host { display: contents; }
    .back-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 12px; border: 0; border-radius: var(--radius-pill, 999px); background: var(--fill); color: var(--ink-900); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background .15s ease; }
    .back-btn:hover { background: var(--fill-strong); }
    .back-btn:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .back-btn app-icon { width: 18px; height: 18px; }
  `]
})
export class BackButton {
  protected nav = inject(NavHistory);
  /** وجهة احتياطية صريحة (تتقدّم على data.back للمسار) */
  fallback = input<string | null>(null);
  protected target = computed(() => this.fallback() ?? this.nav.fallback());
}
