import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { DashboardAction, DashboardActivity, DashboardCountItem, DashboardVacationRow } from '../data-access/dashboard.models';
import { Icon, iconFor } from '@shared/ui/icon';

/* =====================================================
 * مكوّنات مشتركة بين لوحات المتابعة (الفرع/القسم/المكتب/الموظف/المؤسسة)
 * ===================================================== */

/** جدول "آخر الإجراءات" على طلبات الإجازة */
@Component({
  selector: 'app-actions-table', imports: [CommonModule],
  template: `
    @if (actions().length) {
      <div class="table-wrap"><table class="compact">
        <thead><tr><th>الموظف</th>@if (showDepartment()) { <th>القسم</th> }<th>الإجراء</th><th>التاريخ</th></tr></thead>
        <tbody>
          @for (a of actions(); track a.vacationId) {
            <tr>
              <td><strong class="cell-strong">{{ a.employeeName }}</strong></td>
              @if (showDepartment()) { <td>{{ a.departmentName }}</td> }
              <td>
                <span class="status-badge {{ badgeClass(a.actionType) }}"><span class="status-badge-dot"></span>{{ a.action }}</span>
                @if (a.byName) { <small>بواسطة {{ a.byName }}</small> }
              </td>
              <td class="nowrap">{{ a.date | date:'yyyy/MM/dd' }}</td>
            </tr>
          }
        </tbody>
      </table></div>
    } @else {
      <p class="empty-inline">لا توجد إجراءات بعد</p>
    }`,
  styleUrl: '../styles/dashboard-table.scss'
})
export class ActionsTable {
  actions = input.required<DashboardAction[]>();
  showDepartment = input(true);

  badgeClass(type: string) {
    switch (type) {
      case 'Approved': return 'status-active';
      case 'Forwarded': return 'status-completed';
      case 'Rejected': return 'status-rejected';
      case 'Cancelled': return 'status-draft';
      default: return 'status-pending';
    }
  }
}

/** جدول إجازات مختصر (بانتظار القرار / في إجازة الآن وقريباً / آخر طلباتي) */
@Component({
  selector: 'app-vacation-rows', imports: [CommonModule],
  templateUrl: './dashboard-widgets-vacation-rows.html',
  styleUrl: '../styles/dashboard-table.scss'
})
export class VacationRows {
  rows = input.required<DashboardVacationRow[]>();
  emptyText = input('لا توجد بيانات');
  showEmployee = input(true);
  showDepartment = input(false);
  showOffice = input(false);
  showStatus = input(false);

  isNow(v: DashboardVacationRow) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return v.status === 'Approved' && new Date(v.startVac) <= today && new Date(v.endVac) >= today;
  }
}

/**
 * أعمدة أفقية لسلسلة واحدة (مقدار) — لون واحد وقيم مكتوبة بجانب كل عمود، فلا حاجة لمفتاح ألوان.
 * تُستخدم للموظفين حسب الدور (عدد) وللإجازات حسب النوع (أيام).
 */
@Component({
  selector: 'app-count-bars',
  template: `
    @if (items().length) {
      <ul class="bars" role="list">
        @for (item of items(); track item.label) {
          <li class="bar-row" [attr.title]="translate()(item.label) + ': ' + valueText(item)">
            <span class="bar-label">{{ translate()(item.label) }}</span>
            <span class="bar-track" aria-hidden="true"><span class="bar-fill" [style.width.%]="percent(item)"></span></span>
            <span class="bar-value">{{ valueText(item) }}@if (mode() === 'days') { <small>{{ item.count }} طلب</small> }</span>
          </li>
        }
      </ul>
    } @else {
      <p class="empty-inline">{{ emptyText() }}</p>
    }`,
  styles: [`
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: minmax(110px, 200px) 1fr 90px; align-items: center; gap: 14px; padding: 6px 8px; border-radius: var(--radius-sm); }
    .bar-row:hover { background: var(--surface-alt); }
    .bar-label { font-size: 13px; font-weight: 700; color: var(--ink-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { height: 10px; background: var(--ink-100); border-radius: 4px; overflow: hidden; }
    .bar-fill { display: block; height: 100%; min-width: 4px; background: var(--brand-600); border-radius: 4px; }
    .bar-value { font-size: 13px; font-weight: 800; color: var(--ink-900); white-space: nowrap; text-align: left; font-variant-numeric: tabular-nums; }
    .bar-value small { display: block; font-size: 11px; font-weight: 600; color: var(--ink-400); }
    .empty-inline { margin: 0; padding: 18px; text-align: center; color: var(--ink-400); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  `]
})
export class CountBars {
  items = input.required<DashboardCountItem[]>();
  /** count: عدد (مثل الموظفين) — days: أيام مع عدد الطلبات تحتها */
  mode = input<'count' | 'days'>('count');
  unit = input('');
  emptyText = input('لا توجد بيانات');
  translate = input<(label: string) => string>(label => label);
  private max = computed(() => Math.max(1, ...this.items().map(i => this.value(i))));
  private value(i: DashboardCountItem) { return this.mode() === 'days' ? i.days : i.count; }
  percent(i: DashboardCountItem) { return (this.value(i) / this.max()) * 100; }
  valueText(i: DashboardCountItem) { return `${this.value(i)} ${this.mode() === 'days' ? 'يوم' : this.unit()}`.trim(); }
}

/** آخر الإجراءات العامة (انضمام الموظفين) */
@Component({
  selector: 'app-activity-list', imports: [CommonModule, Icon],
  template: `
    @if (items().length) {
      <ol class="activity">
        @for (a of items(); track $index) {
          <li>
            <span class="a-icon" aria-hidden="true"><app-icon [name]="iconFor(a.icon, 'info')" /></span>
            <span class="a-text">{{ a.text }}@if (a.scope) { <small>{{ a.scope }}</small> }</span>
            <time class="a-date" [attr.datetime]="a.date">{{ a.date | date:'yyyy/MM/dd' }}</time>
          </li>
        }
      </ol>
    } @else {
      <p class="empty-inline">لا توجد إجراءات بعد</p>
    }`,
  styles: [`
    .activity { list-style: none; margin: 0; padding: 0; display: grid; }
    .activity li { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 12px; padding: 11px 4px; border-bottom: 1px solid var(--ink-100); }
    .activity li:last-child { border-bottom: 0; }
    .a-icon { width: 36px; height: 36px; border-radius: var(--radius-md); display: grid; place-items: center; background: var(--ink-50); color: var(--ink-700); }
    .a-icon app-icon { width: 18px; height: 18px; }
    .a-text { font-size: 13px; color: var(--ink-800); line-height: 1.6; }
    .a-text small { display: block; font-size: 11px; color: var(--ink-400); }
    .a-date { font-size: 12px; color: var(--ink-500); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .empty-inline { margin: 0; padding: 18px; text-align: center; color: var(--ink-400); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  `]
})
export class ActivityList {
  iconFor = iconFor;
  items = input.required<DashboardActivity[]>();
}
