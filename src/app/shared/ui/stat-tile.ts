import { Component, booleanAttribute, input } from '@angular/core';
import { Icon, IconName } from './icon';

export type StatTone = 'green' | 'blue' | 'purple' | 'orange' | 'red';

/**
 * بطاقة رقم واحد (إحصائية). الأيقونة: اسم من الأيقونات الموحّدة (`icon="users"`).
 * `hint` سطر وصف أسفل الرقم، و`live` نقطة خضراء قبله.
 */
@Component({
  selector: 'app-stat-tile', standalone: true, imports: [Icon],
  template: `
    <article class="stat-card" [class.stat-alert]="alert()">
      <div class="stat-top">
        <span class="stat-icon {{ tone() }}" aria-hidden="true"><app-icon [name]="icon()" /></span>
        <span class="stat-label">{{ label() }}</span>
      </div>
      <strong class="stat-value">{{ value() }}</strong>
      @if (hint() || live()) {
        <div class="stat-footer">
          @if (live()) { <span class="live-dot"></span> }
          <span class="stat-description">{{ hint() }}</span>
        </div>
      }
    </article>`,
  styles: [`
    :host { display: block; min-width: 0; }
    .stat-card { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
    .stat-footer { margin-top: auto; padding-top: 10px; }
    .stat-icon.red { color: var(--danger-600); background: var(--danger-50); }
    .stat-alert { border-color: var(--warning-300); }
  `]
})
export class StatTile {
  label = input.required<string>();
  value = input.required<string | number>();
  hint = input('');
  icon = input.required<IconName>();
  tone = input<StatTone>('green');
  /** إبراز البطاقة (مثل وجود طلبات بانتظار القرار) */
  alert = input(false);
  /** نقطة «متاح» قبل الوصف */
  live = input(false, { transform: booleanAttribute });
}
