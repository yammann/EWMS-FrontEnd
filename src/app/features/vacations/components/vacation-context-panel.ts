import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { VacationService } from '../data-access/vacation.service';
import { VacationApprovalContext } from '../data-access/vacation.models';
import { daysAr, vacationsAr } from '@core/utils/arabic-count';
import { trackRequest } from '@shared/ui/loader';

/**
 * «سجل الموظف» داخل بطاقة طلب الإجازة قبل القرار (قرار المستخدم 2026-10-04): مطوي، ويُحمَّل عند أول فتح.
 * آخر إجازة، الشهر الجاري، الدفع لو اعتُمد الآن، زملاء القسم في نفس الفترة (بالأسماء)، طلباته المعلّقة الأخرى.
 */
@Component({
  selector: 'app-vacation-context-panel', standalone: true, imports: [DatePipe],
  template: `
    <div class="ctx">
      <button type="button" class="toggle" [attr.aria-expanded]="open()" (click)="toggle()">
        <span class="chev" [class.on]="open()" aria-hidden="true">‹</span> {{ open() ? 'إخفاء سجل الموظف' : 'عرض سجل الموظف' }}
      </button>

      @if (open()) {
        @if (loading()) { <p class="muted" role="status">جارٍ التحميل…</p> }
        @else if (error()) { <p class="form-error" role="alert">{{ error() }} <button type="button" class="btn btn-ghost btn-sm" (click)="load()">إعادة المحاولة</button></p> }
        @else if (data(); as c) {
          <div class="tiles">
            <div class="tile">
              <span class="label">آخر إجازة</span>
              @if (c.lastVacation; as l) {
                <strong>{{ l.vacationTypeName }}</strong>
                <span>{{ l.startVac | date:'yyyy/MM/dd' }} — {{ l.endVac | date:'yyyy/MM/dd' }} · {{ days(l.vacDayCount) }}</span>
                <span class="muted">{{ c.daysSinceLastVacation === 0 ? 'في إجازة الآن' : 'قبل ' + days(c.daysSinceLastVacation ?? 0) }}</span>
              } @else { <span class="muted">لا توجد إجازات معتمدة سابقة</span> }
              @if (c.upcomingApproved.length; as n) {
                <span class="upcoming">معتمدة قادمة: {{ vacations(n) }} — أقربها {{ c.upcomingApproved[0].startVac | date:'yyyy/MM/dd' }} ({{ days(c.upcomingApproved[0].vacDayCount) }})</span>
              }
            </div>

            <div class="tile">
              <span class="label">الشهر الجاري</span>
              <strong>{{ vacations(c.monthApprovedCount) }}</strong>
              <span>أيام العمل المعتمدة: {{ days(c.monthApprovedDays) }}</span>
            </div>

            <div class="tile">
              <span class="label">الدفع لو اعتُمد الآن</span>
              @if (!c.typeIsPaid) {
                <strong>غير مدفوعة</strong><span class="muted">نوع الإجازة غير مدفوع — {{ days(c.projectedWorkingDays) }}</span>
              } @else {
                <strong>{{ c.projectedPaidDays }} مدفوع @if (c.projectedUnpaidDays) { · {{ c.projectedUnpaidDays }} غير مدفوع }</strong>
                @for (q of c.monthlyQuota; track q.year + '-' + q.month) {
                  <span class="muted">الرصيد المدفوع {{ q.month }}/{{ q.year }}: استُخدم {{ q.paidUsed }} من {{ c.maxPaidDaysPerMonth }}</span>
                }
              }
            </div>
          </div>

          <div class="block">
            <h4>زملاء {{ c.departmentName ? 'قسم ' + c.departmentName : 'القسم' }} في إجازة خلال نفس الفترة
              <span class="count">{{ c.colleaguesOnLeaveCount }} من {{ c.departmentActiveUsers }}</span></h4>
            @if (c.colleaguesOnLeave.length) {
              <ul>
                @for (x of c.colleaguesOnLeave; track x.id) {
                  <li><strong>{{ x.userName }}</strong> · {{ x.vacationTypeName }} · {{ x.startVac | date:'MM/dd' }} — {{ x.endVac | date:'MM/dd' }}
                    <span class="status-badge" [class.status-active]="x.status === 'Approved'" [class.status-pending]="x.status !== 'Approved'">{{ x.statusAr }}</span></li>
                }
              </ul>
            } @else { <p class="muted">لا أحد من القسم في إجازة خلال هذه الفترة.</p> }
          </div>

          <div class="block">
            <h4>طلبات أخرى معلّقة للموظف <span class="count">{{ c.otherPending.length }}</span></h4>
            @if (c.otherPending.length) {
              <ul>
                @for (x of c.otherPending; track x.id) {
                  <li>{{ x.vacationTypeName }} · {{ x.startVac | date:'yyyy/MM/dd' }} — {{ x.endVac | date:'yyyy/MM/dd' }} · {{ days(x.vacDayCount) }}
                    <span class="status-badge status-pending">{{ x.statusAr }}</span></li>
                }
              </ul>
            } @else { <p class="muted">لا توجد.</p> }
          </div>
        }
      }
    </div>`,
  styles: [`
    .ctx { margin: 10px 0 14px; padding: 10px 14px; border-radius: var(--radius-lg); background: var(--fill); }
    .toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 30px; padding: 0; background: none; color: var(--brand-700); font-weight: 700; font-size: 13px; box-shadow: none; }
    .toggle:hover:not(:disabled) { transform: none; box-shadow: none; background: none; text-decoration: underline; }
    .chev { display: inline-block; transition: transform .2s; transform: rotate(-90deg); }
    .chev.on { transform: rotate(90deg); }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .tile { display: grid; gap: 2px; align-content: start; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface); font-size: 13px; }
    .label { font-size: 12px; color: var(--ink-500); }
    .tile strong { font-size: 14px; }
    .muted { color: var(--ink-500); font-size: 12px; margin: 0; }
    .upcoming { margin-top: 4px; font-size: 12px; color: var(--brand-700); font-weight: 600; }
    .block { margin-top: 12px; }
    h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 13px; }
    .count { padding: 1px 8px; border-radius: 999px; background: var(--surface); color: var(--ink-600); font-size: 12px; font-weight: 700; }
    ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13px; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    @media (max-width: 720px) { .tiles { grid-template-columns: 1fr; } }
  `]
})
export class VacationContextPanel {
  private service = inject(VacationService);
  vacationId = input.required<number>();

  open = signal(false);
  loading = signal(false);
  error = signal('');
  data = signal<VacationApprovalContext | null>(null);
  days = daysAr;
  vacations = vacationsAr;

  toggle() {
    this.open.update(v => !v);
    if (this.open() && !this.data() && !this.loading()) this.load();
  }

  load() {
    trackRequest(this.service.approvalContext(this.vacationId()), this.loading, this.error, d => { this.data.set(d); });
  }
}
