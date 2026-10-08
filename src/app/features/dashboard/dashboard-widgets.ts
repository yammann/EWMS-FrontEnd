import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardAction, DashboardActivity, DashboardCountItem, DashboardVacationRow, WorkTaskDistribution } from '@core/models/dashboard.models';
import { WorkTaskCard } from '@core/models/work-task.models';

/* =====================================================
 * مكوّنات مشتركة بين لوحات المتابعة (الفرع/القسم/المكتب/الموظف/المؤسسة)
 * ===================================================== */

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

/** بطاقات مهام العمل — كل بطاقة تفتح صفحة المهمة (حالياً: جاري العمل عليها) */
@Component({
  selector: 'app-task-cards', standalone: true, imports: [RouterLink],
  template: `
    @if (tasks().length) {
      <div class="task-grid">
        @for (t of tasks(); track t.id) {
          <a class="task-card" [routerLink]="['/tasks', t.id]">
            <span class="task-icon" aria-hidden="true">{{ t.icon || '📋' }}</span>
            <span class="task-text">
              <strong>{{ t.name }}</strong>
              @if (t.description) { <span>{{ t.description }}</span> }
              @if (showAssignees()) { <small>{{ t.assigneesCount }} موظف مسنَد</small> }
            </span>
            <span class="task-go" aria-hidden="true">←</span>
          </a>
        }
      </div>
    } @else {
      <p class="empty-inline">{{ emptyText() }}</p>
    }`,
  styles: [`
    .task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .task-card { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: inherit; text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease; }
    .task-card:hover { border-color: var(--brand-500); box-shadow: var(--shadow-md); }
    .task-card:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .task-icon { flex: none; width: 40px; height: 40px; border-radius: var(--radius-md); display: grid; place-items: center; background: var(--brand-50); font-size: 20px; }
    .task-text { flex: 1; display: grid; gap: 4px; min-width: 0; }
    .task-text strong { font-size: 14px; color: var(--ink-900); }
    .task-text span { font-size: 12px; color: var(--ink-500); line-height: 1.6; overflow-wrap: anywhere; }
    .task-text small { font-size: 11px; color: var(--ink-400); }
    .task-go { color: var(--brand-600); font-weight: 800; align-self: center; }
    .empty-inline { margin: 0; padding: 18px; text-align: center; color: var(--ink-400); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  `]
})
export class TaskCards {
  tasks = input.required<WorkTaskCard[]>();
  emptyText = input('لا توجد مهام بعد');
  showAssignees = input(false);
}

/** جدول "آخر الإجراءات" على طلبات الإجازة */
@Component({
  selector: 'app-actions-table', standalone: true, imports: [CommonModule],
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
  styleUrl: './dashboard-table.scss'
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
  selector: 'app-vacation-rows', standalone: true, imports: [CommonModule],
  template: `
    @if (rows().length) {
      <div class="table-wrap"><table class="compact">
        <thead><tr>
          @if (showEmployee()) { <th>الموظف</th> }
          @if (showDepartment()) { <th>القسم</th> }
          @if (showOffice()) { <th>المكتب</th> }
          <th>النوع</th><th>الفترة</th><th>الأيام</th>
          @if (showStatus()) { <th>الحالة</th> }
        </tr></thead>
        <tbody>
          @for (v of rows(); track v.id) {
            <tr>
              @if (showEmployee()) { <td><strong class="cell-strong">{{ v.employeeName }}</strong></td> }
              @if (showDepartment()) { <td>{{ v.departmentName }}</td> }
              @if (showOffice()) { <td>{{ v.officeName || '—' }}</td> }
              <td>{{ v.vacationTypeName }}<small>{{ v.paymentStatusAr }}</small></td>
              <td class="nowrap">{{ v.startVac | date:'yyyy/MM/dd' }} — {{ v.endVac | date:'yyyy/MM/dd' }}
                @if (isNow(v)) { <small class="now">في إجازة الآن</small> }
              </td>
              <td>{{ v.vacDayCount }}</td>
              @if (showStatus()) {
                <td><span class="status-badge" [class.status-active]="v.status === 'Approved'" [class.status-pending]="v.status.startsWith('Pending')" [class.status-rejected]="v.status === 'Rejected'" [class.status-draft]="v.status === 'Cancelled'"><span class="status-badge-dot"></span>{{ v.statusAr }}</span></td>
              }
            </tr>
          }
        </tbody>
      </table></div>
    } @else {
      <p class="empty-inline">{{ emptyText() }}</p>
    }`,
  styleUrl: './dashboard-table.scss'
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
  selector: 'app-count-bars', standalone: true,
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

/** آخر الإجراءات العامة (انضمام موظفين، إضافة مهام وإسنادها) */
@Component({
  selector: 'app-activity-list', standalone: true, imports: [CommonModule],
  template: `
    @if (items().length) {
      <ol class="activity">
        @for (a of items(); track $index) {
          <li>
            <span class="a-icon" aria-hidden="true">{{ a.icon }}</span>
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
    .a-icon { width: 36px; height: 36px; border-radius: var(--radius-md); display: grid; place-items: center; background: var(--ink-50); font-size: 17px; }
    .a-text { font-size: 13px; color: var(--ink-800); line-height: 1.6; }
    .a-text small { display: block; font-size: 11px; color: var(--ink-400); }
    .a-date { font-size: 12px; color: var(--ink-500); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .empty-inline { margin: 0; padding: 18px; text-align: center; color: var(--ink-400); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  `]
})
export class ActivityList {
  items = input.required<DashboardActivity[]>();
}

/** توزيع مهام العمل على موظفي القسم/المكتب */
@Component({
  selector: 'app-task-distribution', standalone: true, imports: [RouterLink],
  template: `
    @if (items().length) {
      <div class="table-wrap"><table class="compact">
        <thead><tr><th>المهمة</th><th>الموظفون المسؤولون</th></tr></thead>
        <tbody>
          @for (t of items(); track t.taskId) {
            <tr>
              <td><a class="cell-link" [routerLink]="['/tasks', t.taskId]"><span aria-hidden="true">{{ t.icon }}</span> {{ t.taskName }}</a></td>
              <td class="wrap-cell">{{ t.assigneeNames.join('، ') }}</td>
            </tr>
          }
        </tbody>
      </table></div>
    } @else {
      <p class="empty-inline">لم تُسند مهام عمل لموظفين هنا بعد</p>
    }`,
  styleUrl: './dashboard-table.scss'
})
export class TaskDistributionTable {
  items = input.required<WorkTaskDistribution[]>();
}
