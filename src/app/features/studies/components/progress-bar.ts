import { Component, computed, input } from '@angular/core';

/** شريط نسبة الإنجاز بنص مقروء (role=progressbar) — ألوان من الرموز فيتبع المظهر والوضع الداكن */
@Component({
  selector: 'app-study-progress',
  standalone: true,
  template: `
    <span class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="value()" [attr.aria-label]="label()">
      <span class="fill" [class.done]="value() >= 100" [style.width.%]="value()"></span>
    </span>
    <span class="num mono">{{ value() }}%</span>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 8px; min-width: 110px; }
    .track { flex: 1; height: 8px; border-radius: 4px; background: var(--fill-strong); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--brand-500); border-radius: 4px; transition: width .2s; }
    .fill.done { background: var(--brand-700); }
    .num { font-size: 12px; color: var(--ink-600); min-width: 36px; text-align: end; }
  `]
})
export class StudyProgress {
  /** النسبة 0–100 (تُقصّ وتُقرَّب) */
  percent = input.required<number | null | undefined>();
  label = input('نسبة الإنجاز');
  value = computed(() => Math.max(0, Math.min(100, Math.round(this.percent() ?? 0))));
}
