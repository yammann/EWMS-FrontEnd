import { Component, ElementRef, OnDestroy, afterNextRender, input, output, viewChild } from '@angular/core';

/** النوافذ المفتوحة حالياً (الأعلى في آخر المصفوفة) — Esc يغلق الأعلى فقط */
const openStack: Modal[] = [];
let idSeq = 0;

/** هل توجد نافذة مفتوحة؟ (للعناصر غير المنبثقة التي تستمع لـ Esc مثل لوحة تفاصيل المهمة) */
export const hasOpenModal = () => openStack.length > 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * نافذة منبثقة موحّدة: خلفية، عنوان، زر إغلاق، Esc، إغلاق بالنقر خارجها، حبس التركيز داخلها،
 * التركيز على أول حقل عند الفتح وإعادته لمكانه عند الإغلاق، ومنع تمرير الصفحة خلفها.
 * المحتوى يُمرَّر كما هو (عادةً &lt;form&gt; فيه .modal-body و .modal-actions — انظر styles.scss).
 *
 * @example
 * @if (formOpen()) {
 *   <app-modal heading="منطقة جديدة" size="lg" [busy]="saving()" (closed)="closeForm()">
 *     <form ...><div class="modal-body">…</div><footer class="modal-actions">…</footer></form>
 *   </app-modal>
 * }
 */
@Component({
  selector: 'app-modal', standalone: true,
  template: `
    <div class="modal-backdrop" [class.confirm-backdrop]="panelClass() === 'confirm-dialog'" (click)="requestClose()">
      <div #panel [class]="panelClass()" [class.modal-lg]="size() === 'lg'" [attr.role]="role()" aria-modal="true"
           [attr.aria-labelledby]="heading() ? titleId : null" tabindex="-1"
           (click)="$event.stopPropagation()" (keydown.tab)="trapFocus($event)" (keydown.shift.tab)="trapFocus($event)">
        @if (heading()) {
          <header class="modal-header">
            <div>
              @if (kicker()) { <span class="panel-kicker">{{ kicker() }}</span> }
              <h2 [id]="titleId">{{ heading() }}</h2>
              @if (subheading()) { <p class="modal-sub">{{ subheading() }}</p> }
            </div>
            <button type="button" class="modal-close" aria-label="إغلاق" (click)="requestClose()" [disabled]="busy()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>
        }
        <ng-content />
      </div>
    </div>`,
  styles: [`.modal-sub { margin: 4px 0 0; font-size: 12px; color: var(--ink-500); }`],
  host: { '(document:keydown.escape)': 'onEscape($event)' }
})
export class Modal implements OnDestroy {
  heading = input('');
  kicker = input('');
  /** سطر توضيحي تحت العنوان */
  subheading = input('');
  size = input<'md' | 'lg'>('md');
  role = input<'dialog' | 'alertdialog'>('dialog');
  /** أثناء الحفظ: لا إغلاق بالنقر خارجها أو Esc */
  busy = input(false);
  /** 'modal' للنماذج، 'confirm-dialog' لنافذة التأكيد الصغيرة */
  panelClass = input<'modal' | 'confirm-dialog'>('modal');

  closed = output<void>();

  protected titleId = `modal-title-${++idSeq}`;
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private returnFocus = document.activeElement as HTMLElement | null;

  constructor() {
    openStack.push(this);
    document.body.style.overflow = 'hidden';

    afterNextRender(() => {
      const panel = this.panel().nativeElement;
      // الأولوية: [autofocus] ← أول حقل إدخال ← أول عنصر قابل للتركيز (مثل زر في نافذة التأكيد)
      const first = panel.querySelector<HTMLElement>('[autofocus]')
        ?? panel.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')
        ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });
  }

  ngOnDestroy() {
    openStack.splice(openStack.indexOf(this), 1);
    if (!openStack.length) document.body.style.overflow = '';
    this.returnFocus?.focus?.();
  }

  requestClose() {
    if (!this.busy()) this.closed.emit();
  }

  protected onEscape(event: Event) {
    if (openStack.at(-1) !== this) return;
    event.preventDefault();
    this.requestClose();
  }

  /** يبقي Tab داخل النافذة */
  protected trapFocus(event: Event) {
    const items = [...this.panel().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const backwards = (event as KeyboardEvent).shiftKey;
    if (backwards && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!backwards && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}
