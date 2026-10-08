import { AppPermission } from '@core/constants/access';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '@core/services/dashboard.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { EwmsService } from '@core/services/ewms.service';
import { VacationStats } from '@core/models/dashboard.models';
import { Branch } from '@core/models/ewms.models';
import { ActionsTable, CountBars, VacationRows } from '@features/dashboard';
import { StatTile } from '@shared/ui/stat-tile';

/**
 * إحصائيات الإجازات للرؤساء — صفحة مستقلة عن لوحة المتابعة (الإجازات ميزة واحدة من التطبيق).
 * النطاق من الباكاند: رئيس الفرع ← فرعه، رئيس القسم ← قسمه، رئيس المكتب ← مكتبه، SuperAdmin ← الكل أو فرع يختاره.
 */
@Component({
  selector: 'app-vacation-stats', standalone: true,
  imports: [RouterLink, StatTile, VacationRows, ActionsTable, CountBars],
  styleUrl: '../dashboard/dashboard.scss',
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">الإجازات</span>
          <h1>إحصائيات الإجازات</h1>
          @if (data(); as d) { <p class="header-sub">{{ d.scopeName }}</p> }
        </div>
        <div class="header-actions">
          @if (isAdmin()) {
            <select [value]="branchId()" (change)="selectBranch(+$any($event.target).value)" aria-label="اختيار الفرع">
              <option [value]="0">كل المؤسسة</option>
              @for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          }
          <button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="ملخص الإجازات">
          <app-stat-tile label="في إجازة اليوم" [value]="d.onLeaveToday" icon="🌴" tone="green" />
          <app-stat-tile label="تبدأ خلال 7 أيام" [value]="d.upcomingLeavesCount" icon="📆" tone="blue" />
          <app-stat-tile label="طلبات قيد الموافقة" [value]="d.pendingRequests" icon="⏳" tone="orange" [alert]="d.pendingRequests > 0" />
          <app-stat-tile label="أيام إجازة معتمدة" [value]="d.approvedDaysThisMonth" icon="📅" tone="purple" hint="خلال هذا الشهر" />
        </section>

        <section class="panel">
          <div class="panel-heading">
            <div><h2>{{ d.pendingStageLabel }}</h2><p>الأقدم أولاً</p></div>
            @if (canReview()) { <a class="link" routerLink="/vacations/review">مراجعة الطلبات ←</a> }
          </div>
          <app-vacation-rows [rows]="d.pendingApprovals" [showDepartment]="true" [showOffice]="true" [showStatus]="true" emptyText="لا توجد طلبات قيد الموافقة" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>في إجازة الآن وخلال 7 أيام</h2></div></div>
          <app-vacation-rows [rows]="d.onLeave" [showDepartment]="true" [showOffice]="true" emptyText="لا أحد في إجازة الآن أو خلال الأيام القادمة" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الإجازات حسب النوع</h2><p>أيام الإجازات المعتمدة منذ بداية العام</p></div></div>
          <app-count-bars [items]="d.vacationsByType" mode="days" emptyText="لا توجد إجازات معتمدة هذا العام بعد" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات على الطلبات</h2></div></div>
          <app-actions-table [actions]="d.recentActions" />
        </section>
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل إحصائيات الإجازات…</div>
      }
    </div>`
})
export class VacationStatsPage {
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  private ewms = inject(EwmsService);

  data = signal<VacationStats | null>(null);
  branches = signal<Branch[]>([]);
  branchId = signal(0);
  loading = signal(false);
  error = signal('');
  isAdmin = computed(() => this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));
  canReview = computed(() => this.auth.canReviewVacations());

  constructor() {
    this.load();
    if (this.isAdmin()) this.ewms.getBranchLookup().subscribe({ next: b => this.branches.set(b), error: () => {} });
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  selectBranch(id: number) { this.branchId.set(id); this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.vacations(this.branchId() || null).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
