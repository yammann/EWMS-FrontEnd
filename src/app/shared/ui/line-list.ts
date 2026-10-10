import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, model, viewChildren } from '@angular/core';

/** الأسطر غير الفارغة بعد التشذيب — ما يُرسل للخادم */
export function cleanLines(values: readonly string[]): string[] {
  return values.map(v => v.trim()).filter(Boolean);
}

/**
 * قائمة قيم متعددة بنمط وينبوكس (مثل منافذ البريدج): كل قيمة في سطر مستقل،
 * + يضيف سطراً فارغاً تحته ويضع المؤشر فيه، و− يحذف السطر.
 * لوحة المفاتيح: Enter = سطر جديد تحته، Backspace في سطر فارغ = حذفه، ↑↓ للتنقل بين الأسطر،
 * ولصق نص متعدد الأسطر يوزّعه على أسطر. الأسطر الفارغة تبقى في القيمة؛ cleanLines() يزيلها عند الحفظ.
 */
@Component({
  selector: 'app-line-list',
  standalone: true,
  template: `
    <div class="lines" role="list" [attr.aria-label]="label()">
      @for (value of rows(); track $index; let i = $index) {
        <div class="line" role="listitem">
          <input #field type="text" [value]="value" [attr.maxlength]="maxLength()" [placeholder]="i === 0 ? placeholder() : ''"
                 [disabled]="disabled()" [attr.aria-label]="label() + ' ' + (i + 1)"
                 (input)="set(i, field.value)" (keydown)="key($event, i, field)" (paste)="paste($event, i, field)">
          <button type="button" class="step" title="حذف البند" [attr.aria-label]="'حذف ' + label() + ' ' + (i + 1)"
                  [disabled]="disabled()" (click)="remove(i)">−</button>
          <button type="button" class="step" title="إضافة بند بعده" [attr.aria-label]="'إضافة ' + label() + ' بعد ' + (i + 1)"
                  [disabled]="disabled() || full()" (click)="addAfter(i)">+</button>
        </div>
      }
    </div>
    <small class="count" aria-live="polite">{{ filled() }} من {{ max() }}</small>
  `,
  styles: [`
    :host { display: grid; gap: 6px; }
    .lines { display: grid; gap: 6px; }
    .line { display: flex; align-items: center; gap: 6px; }
    .line input { flex: 1; min-width: 0; }
    .step {
      flex-shrink: 0; width: 34px; height: 34px; display: grid; place-items: center; padding: 0;
      border: 1px solid var(--border); border-radius: 8px; background: var(--fill); color: var(--ink-700);
      font-size: 18px; font-weight: 600; line-height: 1; cursor: pointer;
    }
    .step:hover:not(:disabled) { background: var(--fill-strong); color: var(--brand-700); }
    .step:disabled { opacity: .4; cursor: default; }
    .count { color: var(--ink-500); font-size: 12px; justify-self: end; }
  `]
})
export class LineList {
  /** القيم كما هي (قد تحتوي أسطراً فارغة) — ربط ثنائي: [(values)] */
  values = model<string[]>([]);
  max = input(30);
  maxLength = input(200);
  placeholder = input('');
  /** اسم البند للقارئ الصوتي («بند») */
  label = input('بند');
  disabled = input(false);

  private fields = viewChildren<ElementRef<HTMLInputElement>>('field');
  private injector = inject(Injector);

  /** سطر واحد فارغ على الأقل ليكتب فيه المستخدم */
  rows = computed(() => (this.values().length ? this.values() : ['']));
  filled = computed(() => cleanLines(this.values()).length);
  full = computed(() => this.rows().length >= this.max());

  set(i: number, value: string) {
    const next = [...this.rows()];
    next[i] = value;
    this.values.set(next);
  }

  addAfter(i: number) {
    if (this.full()) return;
    const next = [...this.rows()];
    next.splice(i + 1, 0, '');
    this.values.set(next);
    this.focus(i + 1);
  }

  remove(i: number) {
    const rows = this.rows();
    if (rows.length === 1) { this.values.set(['']); this.focus(0); return; }
    this.values.set(rows.filter((_, k) => k !== i));
    this.focus(Math.min(i, rows.length - 2));
  }

  key(e: KeyboardEvent, i: number, field: HTMLInputElement) {
    if (e.key === 'Enter') { e.preventDefault(); this.addAfter(i); }
    else if (e.key === 'Backspace' && field.value === '' && this.rows().length > 1) { e.preventDefault(); this.remove(i); this.focus(Math.max(0, i - 1)); }
    else if (e.key === 'ArrowDown' && i < this.rows().length - 1) { e.preventDefault(); this.focus(i + 1); }
    else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); this.focus(i - 1); }
  }

  /** لصق عدة أسطر (من ملف أو رسالة): كل سطر بند، بعد السطر الحالي (أو مكانه إن كان فارغاً) وضمن الحد */
  paste(e: ClipboardEvent, i: number, field: HTMLInputElement) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const pasted = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.slice(0, this.maxLength()));
    const rows = [...this.rows()];
    const replaceCurrent = field.value.trim() === '';
    const room = this.max() - rows.length + (replaceCurrent ? 1 : 0);
    const lines = pasted.slice(0, Math.max(0, room));
    if (!lines.length) return;
    rows.splice(replaceCurrent ? i : i + 1, replaceCurrent ? 1 : 0, ...lines);
    this.values.set(rows);
    this.focus((replaceCurrent ? i : i + 1) + lines.length - 1);
  }

  /** المؤشر في السطر بعد رسم القائمة الجديدة */
  private focus(i: number) {
    afterNextRender(() => {
      const input = this.fields()[i]?.nativeElement;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, { injector: this.injector });
  }
}
