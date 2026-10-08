import { Component, input } from '@angular/core';

export type StatTone = 'green' | 'blue' | 'purple' | 'orange' | 'red';

/** بطاقة رقم واحد (إحصائية) */
@Component({
  selector: 'app-stat-tile', standalone: true,
  template: `
    <article class="stat-card" [class.stat-alert]="alert()">
      <div class="stat-top">
        <span class="stat-icon {{ tone() }}" aria-hidden="true">{{ icon() }}</span>
        <span class="stat-label">{{ label() }}</span>
      </div>
      <strong class="stat-value">{{ value() }}</strong>
      @if (hint()) { <div class="stat-footer"><span class="stat-description">{{ hint() }}</span></div> }
    </article>`,
  styles: [`
    :host { display: block; min-width: 0; }
    .stat-card { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
    .stat-footer { margin-top: auto; padding-top: 10px; }
    .stat-icon { font-size: 18px; }
    .stat-icon.red { color: var(--danger-600); background: var(--danger-50); }
    .stat-alert { border-color: var(--warning-300); }
  `]
})
export class StatTile {
  label = input.required<string>();
  value = input.required<string | number>();
  hint = input('');
  icon = input('•');
  tone = input<StatTone>('green');
  /** إبراز البطاقة (مثل وجود طلبات بانتظار القرار) */
  alert = input(false);
}
