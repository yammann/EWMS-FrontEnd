import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { BranchDashboard } from '../../core/models/dashboard.models';
import { roleLabel } from '../../core/utils/roles';
import { ActivityList, CountBars, StatTile, TaskCards, TaskDistributionTable } from './dashboard-widgets';

/** لوحة رئيس الفرع (إحصائيات عامة للفرع) — ويفتحها SuperAdmin لأي فرع عبر /dashboard/branch/:id */
@Component({
  selector: 'app-branch-dashboard', standalone: true,
  imports: [RouterLink, StatTile, TaskCards, TaskDistributionTable, CountBars, ActivityList],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      @if (isAdmin()) { <nav class="crumbs" aria-label="المسار"><a routerLink="/">المؤسسة</a><span>/</span><span>{{ data()?.branchName }}</span></nav> }
      <header class="page-header">
        <div>
          <span class="eyebrow">لوحة رئيس الفرع</span>
          <h1>{{ data()?.branchName || 'الفرع' }}</h1>
          @if (data()?.managerNames) { <p class="header-sub">رئيس الفرع: {{ data()?.managerNames }}</p> }
        </div>
        <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="إحصائيات الفرع">
          <app-stat-tile label="الأقسام" [value]="d.departmentsCount" icon="🏢" tone="blue" />
          <app-stat-tile label="المكاتب" [value]="d.officesCount" icon="🚪" tone="purple" />
          <app-stat-tile label="الموظفون" [value]="d.employeesCount" icon="👥" tone="green" />
          <app-stat-tile label="مهام الفرع" [value]="d.tasksCount" icon="📋" tone="orange" [hint]="d.employeesWithTasks + ' موظف مسؤول عن مهام'" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><span class="panel-kicker">مهام الفرع</span><h2>المهام التي يقوم بها الفرع</h2><p>تختلف من فرع لآخر — كل بطاقة تفتح صفحة المهمة</p></div></div>
          <app-task-cards [tasks]="d.tasks" [showAssignees]="true" emptyText="لم تُعرَّف مهام لهذا الفرع بعد — يضيفها مدير النظام من صفحة مهام العمل" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>أقسام الفرع</h2><p>اضغط على القسم لعرض لوحته</p></div></div>
          @if (d.departments.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>القسم</th><th>رئيس القسم</th><th>المكاتب</th><th>الموظفون</th><th>مسؤولون عن مهام</th></tr></thead>
              <tbody>
                @for (dep of d.departments; track dep.id) {
                  <tr>
                    <td><a class="cell-link" [routerLink]="['/dashboard/department', dep.id]">{{ dep.name }}</a></td>
                    <td [class.muted-cell]="!dep.managerNames">{{ dep.managerNames || 'لم يُعيَّن' }}</td>
                    <td class="num">{{ dep.officesCount }}</td>
                    <td class="num">{{ dep.employeesCount }}</td>
                    <td class="num">{{ dep.employeesWithTasks }} من {{ dep.employeesCount }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="empty-state">لا توجد أقسام في هذا الفرع</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>توزيع مهام العمل</h2><p>من المسؤول عن كل مهمة في الفرع</p></div></div>
          <app-task-distribution [items]="d.taskDistribution" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الكادر حسب الدور</h2></div></div>
          <app-count-bars [items]="d.employeesByRole" unit="موظف" [translate]="roleLabel" emptyText="لا يوجد موظفون في هذا الفرع" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإضافة مهام العمل وإسنادها في الفرع</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

        @if (!isAdmin()) {
          <a class="jump" routerLink="/vacations/stats">
            <div><strong>إحصائيات إجازات الفرع</strong><span>من في إجازة، الطلبات بانتظار اعتمادك، والإجازات حسب النوع</span></div>
            <span class="go">فتح ←</span>
          </a>
        }
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحة الفرع…</div>
      }
    </div>`
})
export class BranchDashboardPage {
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  roleLabel = roleLabel;

  data = signal<BranchDashboard | null>(null);
  loading = signal(false);
  error = signal('');
  isAdmin = computed(() => this.auth.isSuperAdmin());
  private id: number | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id = p.get('id') ? Number(p.get('id')) : null;
      this.load();
    });
    // تحديث تلقائي عند وصول إشعار — بدون إعادة تحميل الصفحة
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.branch(this.id).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
