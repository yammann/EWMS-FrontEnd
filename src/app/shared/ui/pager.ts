import { Component, computed, input, output } from '@angular/core';

/**
 * تقسيم صفحات موحّد للمشروع كله: «عرض 1–10 من 56»، السابق/التالي وأرقام الصفحات (مع ... عند الكثرة)، واختيار حجم الصفحة.
 * يختفي حين يكفي عدد العناصر صفحة واحدة بأصغر حجم متاح. الصفحة تبدأ من 1.
 * للقوائم المحمّلة كاملة استعمل Pagination (core/utils/pagination.ts)، وللمقسَّمة من الخادم اربط الصفحة والحجم والعدد الكلي مباشرة.
 *
 * @example <app-pager [page]="p.page()" [pageSize]="p.size()" [total]="p.total()" (pageChange)="p.go($event)" (sizeChange)="p.setSize($event)" />
 */
@Component({
  selector: 'app-pager', standalone: true,
  template: `
    @if (visible()) {
      <nav class="pager" aria-label="تقسيم الصفحات">
        <span class="range" aria-live="polite">عرض <strong>{{ from() }}–{{ to() }}</strong> من <strong>{{ total() }}</strong></span>
        @if (pages() > 1) {
          <div class="pages">
            <button type="button" class="nav" (click)="go(page() - 1)" [disabled]="page() <= 1 || disabled()" aria-label="الصفحة السابقة">‹ السابق</button>
            @for (p of numbers(); track $index) {
              @if (p === 0) { <span class="gap" aria-hidden="true">…</span> }
              @else { <button type="button" class="num" [class.on]="p === page()" [attr.aria-current]="p === page() ? 'page' : null" (click)="go(p)" [disabled]="disabled()" [attr.aria-label]="'الصفحة ' + p">{{ p }}</button> }
            }
            <button type="button" class="nav" (click)="go(page() + 1)" [disabled]="page() >= pages() || disabled()" aria-label="الصفحة التالية">التالي ›</button>
          </div>
        }
        @if (sizes().length > 1) {
          <label class="size"><span>في الصفحة</span>
            <select #t1 [value]="pageSize()" (change)="sizeChange.emit(+t1.value)" aria-label="عدد العناصر في الصفحة">
              @for (s of sizes(); track s) { <option [value]="s">{{ s }}</option> }
            </select></label>
        }
      </nav>
    }`,
  styles: [`
    :host { display: block; }
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; padding: 12px 4px 0; font-size: 13px; color: var(--ink-500); }
    .range strong { color: var(--ink-800); font-variant-numeric: tabular-nums; }
    .pages { display: inline-flex; align-items: center; gap: 4px; }
    .pages button { min-height: 36px; min-width: 36px; padding: 0 10px; border-radius: var(--radius-full); border: 1px solid transparent; background: transparent; color: var(--ink-600); font-size: 13px; font-weight: 700; box-shadow: none; font-variant-numeric: tabular-nums; }
    .pages button:hover:not(:disabled) { background: var(--fill); color: var(--ink-900); transform: none; box-shadow: none; }
    .pages button:disabled { opacity: .4; }
    .pages .nav { padding: 0 14px; border-color: var(--border-strong); background: var(--surface); }
    .pages .num.on { background: var(--ink-900); color: var(--surface); }
    .pages .num.on:hover:not(:disabled) { background: var(--ink-900); color: var(--surface); }
    .gap { padding: 0 4px; color: var(--ink-400); }
    .size { display: inline-flex; align-items: center; gap: 8px; }
    .size select { width: auto; min-height: 34px; padding-block: 0; }
    @media (max-width: 560px) { .pager { justify-content: center; } .pages .nav { padding: 0 10px; } }
  `]
})
export class Pager {
  /** رقم الصفحة الحالية (من 1) */
  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();
  /** أحجام الصفحة المتاحة للاختيار (فارغة أو بحجم واحد = بلا اختيار) */
  sizes = input<number[]>([10, 25, 50]);
  /** يعطّل الأزرار أثناء التحميل */
  disabled = input(false);

  pageChange = output<number>();
  sizeChange = output<number>();

  pages = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))));
  from = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  /** يظهر إن زاد العدد عن أصغر حجم صفحة متاح (وإلا فصفحة واحدة تكفي) */
  visible = computed(() => this.total() > Math.min(this.pageSize(), ...(this.sizes().length ? this.sizes() : [this.pageSize()])));

  /** أرقام الصفحات المعروضة؛ 0 = «…» (الأولى، الأخيرة، وما حول الحالية) */
  numbers = computed(() => {
    const total = this.pages(), current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, current, current - 1, current + 1].filter(p => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push(0); out.push(p); });
    return out;
  });

  go(page: number) {
    const target = Math.min(Math.max(1, page), this.pages());
    if (target !== this.page()) this.pageChange.emit(target);
  }
}
