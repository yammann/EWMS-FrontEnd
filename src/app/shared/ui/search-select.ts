import {
  Component, Directive, ElementRef, booleanAttribute, computed, contentChildren, forwardRef, inject, input, output,
  signal, viewChild, OnDestroy, Input
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';

/**
 * تطبيع نص عربي للبحث: يتجاهل التشكيل والتطويل وحالة الأحرف، ويوحّد أ/إ/آ←ا، ة←ه، ى←ي.
 * (NFKD يفكّك الهمزات فوق/تحت الألف إلى ألف + علامة نحذفها؛ ويفكّك أشكال العرض العربية.)
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const NO_VALUE = Symbol('no-value');

/**
 * خيار داخل <app-select> — يُكتب كـ <option> عادي تماماً كما في <select>:
 * `<option value="">الكل</option>`، `<option [value]="x.id">…</option>`، `<option [ngValue]="x">…</option>`،
 * داخل <optgroup [label]> أو حلقات @for/@if. لا يُرسم في الصفحة؛ <app-select> يقرأ قيمته ونصّه.
 */
// eslint-disable-next-line @angular-eslint/directive-selector -- عمداً: <option> داخل <app-select> كما في <select>
@Directive({ selector: 'option', standalone: true })
export class SelectOption {
  private readonly el = inject<ElementRef<HTMLOptionElement>>(ElementRef).nativeElement;
  /** مثل value في <option>: تُحوَّل إلى نص (كما يفعل المتصفح) */
  readonly value = input<unknown>(undefined);
  /** مثل ngValue في Angular forms: القيمة كما هي (رقم، كائن…) */
  readonly ngValue = input<unknown>(NO_VALUE);
  readonly disabled = input(false, { transform: booleanAttribute });

  get label(): string { return (this.el.textContent ?? '').replace(/\s+/g, ' ').trim(); }
  get group(): string | null {
    const parent = this.el.parentElement;
    return parent?.tagName === 'OPTGROUP' ? (parent as HTMLOptGroupElement).label : null;
  }
  get isRaw(): boolean { return this.ngValue() !== NO_VALUE; }
  get optionValue(): unknown {
    if (this.isRaw) return this.ngValue();
    const v = this.value();
    return v === undefined ? this.label : String(v ?? '');
  }
}

/** خيار موحّد للعرض */
export interface SelectItem {
  value: unknown;
  label: string;
  disabled?: boolean;
  group?: string | null;
}

interface Item extends Required<SelectItem> {
  /** القيمة تُقارن بـ compareWith (ngValue / options) وليس كنص */
  raw: boolean;
}

let seq = 0;

/**
 * قائمة منسدلة موحّدة قابلة للبحث — بديل <select> في كل التطبيق.
 * تعمل مع formControlName / [formControl] / ngModel، ومع [value] + (change) + مرجع القالب (#ref.value) كالـ <select> الأصلي.
 *
 * @example
 * <app-select id="create-role" formControlName="roleId" placeholder="اختر الدور">
 *   <option value="">اختر الدور</option>
 *   @for (role of roles(); track role.id) { <option [value]="role.id">{{ role.name }}</option> }
 * </app-select>
 *
 * <app-select [options]="branches()" labelKey="name" valueKey="id" [(ngModel)]="branchId" emptyOption="كل الفروع" />
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelect), multi: true }],
  host: {
    class: 'app-select',
    // المعرّف ينتقل إلى الزر الداخلي (لـ <label for>) — لا نُبقيه مكرّراً على العنصر المضيف
    '[attr.id]': 'null',
    '[class.is-open]': 'open()',
    '[class.is-disabled]': 'isDisabled()',
  },
  template: `
    <button #trigger type="button" class="ss-trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin"
            [attr.id]="id() || null" [disabled]="isDisabled()"
            role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open()"
            [attr.aria-controls]="open() ? listId : null"
            [attr.aria-label]="labelText()" [attr.aria-labelledby]="ariaLabelledby() || null"
            [attr.aria-required]="required() || null" [attr.title]="title() || host.getAttribute('title') || null"
            (click)="toggle()" (keydown)="onTriggerKeydown($event)" (blur)="onBlur()">
      <span class="ss-value" [class.ss-muted]="isEmpty()">{{ displayLabel() }}</span>
      <svg class="ss-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayWidth]="panelWidth()"
                 [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8"
                 cdkConnectedOverlayPanelClass="app-select-overlay"
                 (overlayOutsideClick)="onOutsideClick($event)" (detach)="close(false)" (attach)="onAttach()">
      <div class="ss-panel" dir="rtl" (keydown)="onPanelKeydown($event)">
        <div class="ss-search">
          <input #search type="search" class="ss-search-input" autocomplete="off" spellcheck="false"
                 [placeholder]="searchPlaceholder()" [value]="query()" (input)="onQuery(search.value)"
                 role="combobox" aria-autocomplete="list" aria-expanded="true" [attr.aria-controls]="listId"
                 [attr.aria-activedescendant]="activeIndex() >= 0 ? optionId(activeIndex()) : null"
                 [attr.aria-label]="searchPlaceholder()">
        </div>
        <div #list class="ss-list" role="listbox" [id]="listId" [attr.aria-label]="labelText() || placeholder() || null">
          @for (item of filtered(); track $index; let i = $index) {
            @if (item.group && item.group !== filtered()[i - 1]?.group) {
              <div class="ss-group" role="presentation">{{ item.group }}</div>
            }
            <div class="ss-option" role="option" [id]="optionId(i)"
                 [class.is-active]="i === activeIndex()" [class.is-selected]="isSelected(item)"
                 [class.is-disabled]="item.disabled" [class.ss-muted]="isEmptyValue(item.value)"
                 [attr.aria-selected]="isSelected(item)" [attr.aria-disabled]="item.disabled || null"
                 (mousedown)="$event.preventDefault()" (mousemove)="activeIndex.set(i)" (click)="choose(item)">
              <span class="ss-label">{{ item.label }}</span>
              @if (isSelected(item)) {
                <svg class="ss-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>
              }
            </div>
          } @empty {
            <div class="ss-empty" role="presentation">{{ noResultsText() }}</div>
          }
        </div>
      </div>
    </ng-template>`,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; position: relative; }

    .ss-trigger {
      position: relative;
      display: flex; align-items: center; justify-content: flex-start;
      width: 100%; height: var(--select-height, 42px); min-height: 0;
      margin: 0;
      padding-block: 0;
      padding-inline: var(--select-pad-start, 14px) 36px;
      border: 1px solid transparent; border-radius: var(--radius-md);
      background: var(--fill); color: var(--ink-900);
      font: inherit; font-size: var(--select-font-size, 14px); font-weight: 400; line-height: 1.4; text-align: start;
      cursor: pointer; outline: none;
      transition: background-color .2s var(--ease), border-color .2s var(--ease), box-shadow .2s var(--ease);
    }
    .ss-trigger:hover:not(:disabled), .ss-trigger:active:not(:disabled) { filter: none; transform: none; }
    .ss-trigger:hover:not(:focus):not(:disabled) { background-color: var(--fill-strong); }
    .ss-trigger:focus-visible, :host(.is-open) .ss-trigger {
      background-color: var(--surface); border-color: var(--brand-500); box-shadow: 0 0 0 4px var(--focus-ring);
    }
    .ss-trigger:disabled { opacity: .55; cursor: not-allowed; }
    :host(.ng-invalid.ng-touched) .ss-trigger { border-color: var(--danger-600); }

    .ss-value { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .ss-muted { color: var(--ink-400); }
    .ss-chevron {
      position: absolute; inset-inline-end: 12px; top: 50%;
      width: 15px; height: 15px; transform: translateY(-50%);
      fill: none; stroke: var(--ink-400); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;
      transition: transform .2s var(--ease); pointer-events: none;
    }
    :host(.is-open) .ss-chevron { transform: translateY(-50%) rotate(180deg); }

    .ss-panel {
      display: flex; flex-direction: column;
      width: 100%; min-width: 200px; max-height: min(360px, 60vh);
      margin-block: 6px;
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface-raised); color: var(--ink-900);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: ss-in .14s var(--ease);
    }
    @keyframes ss-in { from { opacity: 0; transform: translateY(-4px); } }
    .ss-search { padding: 8px; border-bottom: 1px solid var(--border); }
    .ss-search-input { height: 36px; font-size: 13px; }
    .ss-list { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 4px; }
    .ss-group {
      padding: 8px 10px 4px; color: var(--ink-500); font-size: 11px; font-weight: 700;
    }
    .ss-option {
      display: flex; align-items: center; gap: 8px;
      min-height: 36px; padding: 7px 10px;
      border-radius: var(--radius-xs);
      font-size: 14px; line-height: 1.5; cursor: pointer;
    }
    .ss-option.is-active { background: var(--fill); }
    .ss-option.is-selected { background: var(--brand-50); color: var(--brand-700); font-weight: 700; }
    .ss-option.is-selected.is-active { background: var(--brand-100); }
    .ss-option.is-disabled { opacity: .45; cursor: not-allowed; }
    .ss-label { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    .ss-check { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .ss-empty { padding: 14px 10px; color: var(--ink-400); font-size: 13px; text-align: center; }
  `]
})
export class SearchSelect implements ControlValueAccessor, OnDestroy {
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** يُنقل إلى الزر الداخلي ليعمل <label for="…"> */
  readonly id = input<string | null | undefined>(null);
  /** خيارات من مصفوفة (بديل/إضافة لعناصر <option> المُمرَّرة) */
  readonly options = input<readonly unknown[] | null | undefined>(null);
  readonly labelKey = input('label');
  readonly valueKey = input('value');
  /** النص الظاهر حين لا تُطابق القيمة أي خيار */
  readonly placeholder = input('');
  readonly searchPlaceholder = input('بحث…');
  readonly noResultsText = input('لا توجد نتائج');
  /** خيار «فارغ» يُضاف أولاً (مثل «الكل» أو «بدون») بالقيمة emptyValue */
  readonly emptyOption = input<string | null>(null);
  readonly emptyValue = input<unknown>('');
  readonly compareWith = input<(a: unknown, b: unknown) => boolean>(Object.is);
  // eslint-disable-next-line @angular-eslint/no-input-rename -- [disabled] كما في <select>؛ الاسم الداخلي يميّزه عن حالة النموذج
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null | undefined>(null, { alias: 'aria-label' });
  readonly ariaLabelledby = input<string | null | undefined>(null, { alias: 'aria-labelledby' });
  readonly title = input<string | null | undefined>(null);

  /** مثل حدث change في <select>: يُطلق عند اختيار المستخدم قيمة مختلفة (بعد تحديث النموذج) */
  // eslint-disable-next-line @angular-eslint/no-output-native -- عمداً: بديل مباشر لـ (change) في <select> القديم
  readonly change = output<unknown>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  /** القيمة الحالية — تُكتب بـ [value] وتُقرأ عبر مرجع القالب (#ref.value) كما في <select> */
  @Input()
  // any: كقيمة <select> الأصلي (نص) في القوالب القديمة — t.value تُمرَّر مباشرة لدوال تتوقع string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get value(): any {
    const item = this.selectedItem();
    return item ? item.value : '';
  }
  set value(v: unknown) { this.writeValue(v); }

  protected readonly listId = `app-select-list-${++seq}`;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly panelWidth = signal<number>(0);
  private readonly formDisabled = signal(false);
  private readonly current = signal<unknown>(undefined);
  /** هل كُتبت قيمة؟ (بدونها يختار <select> الأصلي الخيار الأول) */
  private readonly written = signal(false);
  /** عناصر <option> المُمرَّرة (داخل @for/@if/<optgroup>) */
  private readonly projected = contentChildren(SelectOption, { descendants: true });

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly overlay = viewChild(CdkConnectedOverlay);

  protected readonly isDisabled = computed(() => this.disabledInput() || this.formDisabled());

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];

  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly onScroll = (event: Event) => {
    const pane = this.overlay()?.overlayRef?.overlayElement;
    if (pane && event.target instanceof Node && pane.contains(event.target)) return;
    // تمرير الصفحة/النافذة: تتبع اللوحة الحقل، وتُغلق فقط إن خرج الحقل من الشاشة
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) this.close(false);
    else this.overlay()?.overlayRef?.updatePosition();
  };

  ngOnDestroy() { document.removeEventListener('scroll', this.onScroll, true); }

  // ---------- الخيارات ----------

  /** كل الخيارات (تُحسب في كل قراءة لأن نصوص <option> قد تتغيّر بلا إشارة) */
  protected items(): Item[] {
    const items: Item[] = [];
    const empty = this.emptyOption();
    if (empty != null) items.push({ value: this.emptyValue(), label: empty, disabled: false, group: null, raw: true });
    const labelKey = this.labelKey(), valueKey = this.valueKey();
    for (const o of this.options() ?? []) {
      if (o !== null && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        items.push({
          value: rec[valueKey], label: String(rec[labelKey] ?? ''),
          disabled: !!rec['disabled'], group: (rec['group'] as string | undefined) ?? null, raw: true
        });
      } else {
        items.push({ value: o, label: String(o ?? ''), disabled: false, group: null, raw: true });
      }
    }
    for (const o of this.projected()) {
      items.push({ value: o.optionValue, label: o.label, disabled: o.disabled(), group: o.group, raw: o.isRaw });
    }
    return items;
  }

  protected filtered(): Item[] {
    const q = normalizeSearch(this.query());
    const all = this.items();
    if (!q) return all;
    const terms = q.split(' ');
    return all.filter(item => {
      const hay = normalizeSearch(`${item.label} ${item.group ?? ''}`);
      return terms.every(t => hay.includes(t));
    });
  }

  private matches(item: Item, v: unknown): boolean {
    if (item.raw) {
      if (this.compareWith()(item.value, v)) return true;
      // قيم من options/ngValue: 5 و '5' متطابقتان (قيم النماذج القادمة من الخادم أحياناً نصية)
      return v != null && item.value != null && typeof v !== 'object' && typeof item.value !== 'object'
        && String(item.value) === String(v);
    }
    // <option value>: القيمة نص — كما يقارنها المتصفح؛ null/'' يطابق الخيار الفارغ
    if (v == null) return item.value === '';
    return typeof v !== 'object' && String(v) === item.value;
  }

  private selectedItem(): Item | null {
    const items = this.items();
    if (!this.written()) return items.find(i => !i.disabled) ?? null;
    const v = this.current();
    return items.find(i => this.matches(i, v))
      ?? (v === '' || v == null ? items.find(i => this.isEmptyValue(i.value)) ?? null : null);
  }

  protected isSelected(item: Item): boolean {
    const sel = this.selectedItem();
    return !!sel && sel.value === item.value && sel.label === item.label;
  }

  protected isEmptyValue(v: unknown): boolean { return v === '' || v == null; }

  protected isEmpty(): boolean {
    const sel = this.selectedItem();
    return !sel || this.isEmptyValue(sel.value);
  }

  protected displayLabel(): string {
    const sel = this.selectedItem();
    if (sel && !(this.isEmptyValue(sel.value) && this.placeholder() && !sel.label)) return sel.label;
    return this.placeholder();
  }

  protected optionId(i: number) { return `${this.listId}-opt-${i}`; }

  /** aria-label كمُدخل أو كسمة على العنصر ([attr.aria-label]) */
  protected labelText(): string | null { return this.ariaLabel() || this.host.getAttribute('aria-label') || null; }

  // ---------- فتح/إغلاق ----------

  protected toggle() { if (this.open()) this.close(); else this.openPanel(); }

  openPanel(initialQuery = '') {
    if (this.isDisabled() || this.open()) return;
    this.panelWidth.set(Math.max(this.trigger().nativeElement.getBoundingClientRect().width, 220));
    this.query.set(initialQuery);
    const list = this.filtered();
    const selected = this.selectedItem();
    const idx = selected && !initialQuery ? list.findIndex(i => this.isSelected(i)) : -1;
    this.activeIndex.set(idx >= 0 ? idx : this.firstEnabled(list));
    this.open.set(true);
    document.addEventListener('scroll', this.onScroll, true);
    this.opened.emit();
  }

  close(restoreFocus = true) {
    if (!this.open()) return;
    this.open.set(false);
    this.query.set('');
    document.removeEventListener('scroll', this.onScroll, true);
    if (restoreFocus) this.trigger().nativeElement.focus();
    this.onTouched();
    this.closed.emit();
  }

  protected onAttach() {
    const input = this.searchInput()?.nativeElement;
    if (input) {
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    this.scrollActiveIntoView();
  }

  protected onOutsideClick(event: MouseEvent) {
    // النقر على الحقل نفسه يتولاه toggle()
    if (event.target instanceof Node && this.host.contains(event.target)) return;
    this.close(false);
  }

  protected onBlur() { if (!this.open()) this.onTouched(); }

  // ---------- الاختيار ----------

  protected choose(item: Item) {
    if (item.disabled) return;
    const changed = !this.written() || !this.isSelected(item);
    this.current.set(item.value);
    this.written.set(true);
    this.close();
    if (changed) {
      this.onChange(item.value);
      this.change.emit(item.value);
    }
  }

  protected onQuery(text: string) {
    this.query.set(text);
    this.activeIndex.set(this.firstEnabled(this.filtered()));
    this.scrollActiveIntoView();
  }

  // ---------- لوحة المفاتيح ----------

  protected onTriggerKeydown(event: KeyboardEvent) {
    if (this.isDisabled()) return;
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'F4') {
      event.preventDefault();
      this.openPanel();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // الكتابة مباشرة على الحقل تفتح القائمة وتبدأ البحث
      event.preventDefault();
      this.openPanel(key);
    }
  }

  protected onPanelKeydown(event: KeyboardEvent) {
    const list = this.filtered();
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); this.move(list, 1); break;
      case 'ArrowUp': event.preventDefault(); this.move(list, -1); break;
      case 'PageDown': event.preventDefault(); this.move(list, 8); break;
      case 'PageUp': event.preventDefault(); this.move(list, -8); break;
      case 'Home': if (event.ctrlKey) { event.preventDefault(); this.activeIndex.set(this.firstEnabled(list)); this.scrollActiveIntoView(); } break;
      case 'End': if (event.ctrlKey) { event.preventDefault(); this.move(list, list.length); } break;
      case 'Enter': {
        event.preventDefault();
        const item = list[this.activeIndex()];
        if (item) this.choose(item);
        break;
      }
      case 'Escape':
        // لا نُغلق النافذة المنبثقة الأم مع القائمة
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
      case 'Tab':
        event.preventDefault();
        this.close();
        break;
    }
  }

  private move(list: Item[], delta: number) {
    if (!list.length) return;
    let i = this.activeIndex();
    const step = delta > 0 ? 1 : -1;
    let remaining = Math.abs(delta);
    let next = i;
    while (remaining > 0) {
      let j = next + step;
      while (j >= 0 && j < list.length && list[j].disabled) j += step;
      if (j < 0 || j >= list.length) break;
      next = j;
      remaining--;
    }
    if (next === i && i < 0) next = this.firstEnabled(list);
    i = next;
    this.activeIndex.set(i);
    this.scrollActiveIntoView();
  }

  private firstEnabled(list: Item[]) { return list.findIndex(i => !i.disabled); }

  private scrollActiveIntoView() {
    const i = this.activeIndex();
    if (i < 0) return;
    queueMicrotask(() => setTimeout(() => document.getElementById(this.optionId(i))?.scrollIntoView?.({ block: 'nearest' })));
  }

  // ---------- ControlValueAccessor ----------

  writeValue(v: unknown) {
    this.current.set(v);
    this.written.set(true);
  }
  registerOnChange(fn: (v: unknown) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(disabled: boolean) {
    this.formDisabled.set(disabled);
    if (disabled) this.close(false);
  }

  /** للتركيز البرمجي (مثل [autofocus] أو أول حقل في نافذة) */
  focus() { this.trigger().nativeElement.focus(); }
}

/** للاستيراد في المكوّنات: `imports: [...SELECT]` يضيف <app-select> و <option> الخاص به */
export const SELECT = [SearchSelect, SelectOption] as const;
