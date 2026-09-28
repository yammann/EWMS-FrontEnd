import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { OverviewDashboard } from '../../core/models/dashboard.models';
import { roleLabel } from '../../core/utils/roles';
import { ActivityList, CountBars, StatTile } from './dashboard-widgets';

/** لوحة مدير النظام: إحصائيات عامة للمؤسسة + الدخول لأي فرع + صفحات الإدارة */
@Component({
  selector: 'app-overview-dashboard', standalone: true,
  imports: [RouterLink, StatTile, ActivityList, CountBars],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">مدير النظام</span><h1>نظرة عامة على المؤسسة</h1><p class="header-sub">الهيكل التنظيمي والكادر ومهام العمل في كل الفروع</p></div>
        <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="إحصائيات المؤسسة">
          <app-stat-tile label="الفروع" [value]="d.branchesCount" icon="🏛️" tone="green" [hint]="d.workTasksCount + ' مهمة عمل فعّالة'" />
          <app-stat-tile label="الأقسام" [value]="d.departmentsCount" icon="🏢" tone="blue" />
          <app-stat-tile label="المكاتب" [value]="d.officesCount" icon="🚪" tone="purple" />
          <app-stat-tile label="الموظفون" [value]="d.employeesCount" icon="👥" tone="orange" [hint]="d.employeesWithTasks + ' منهم مسؤولون عن مهام عمل'" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الفروع</h2><p>اضغط على الفرع لعرض لوحته</p></div></div>
          @if (d.branches.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>الفرع</th><th>رئيس الفرع</th><th>الأقسام</th><th>المكاتب</th><th>الموظفون</th><th>مهام العمل</th></tr></thead>
              <tbody>
                @for (b of d.branches; track b.id) {
                  <tr>
                    <td><a class="cell-link" [routerLink]="['/dashboard/branch', b.id]">{{ b.name }}</a></td>
                    <td [class.muted-cell]="!b.managerNames">{{ b.managerNames || 'لم يُعيَّن' }}</td>
                    <td class="num">{{ b.departmentsCount }}</td>
                    <td class="num">{{ b.officesCount }}</td>
                    <td class="num">{{ b.employeesCount }}</td>
                    <td class="num">{{ b.tasksCount }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="empty-state">لا توجد فروع بعد</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الكادر حسب الدور</h2><p>عدد الموظفين الفعّالين في كل دور</p></div></div>
          <app-count-bars [items]="d.employeesByRole" unit="موظف" [translate]="roleLabel" emptyText="لا يوجد موظفون بعد" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإضافة مهام العمل وإسنادها</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

        <a class="jump" routerLink="/vacations/stats">
          <div><strong>إحصائيات الإجازات</strong><span>من في إجازة، الطلبات قيد الموافقة، والإجازات حسب النوع</span></div>
          <span class="go">فتح ←</span>
        </a>
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل النظرة العامة…</div>
      }

      <section class="panel">
        <div class="panel-heading"><div><span class="panel-kicker">الإدارة</span><h2>إدارة النظام</h2></div></div>
        <div class="cards">
          @for (item of links; track item.path) {
            @if (auth.hasPermission(item.permission)) {
              <a class="link-card" [routerLink]="item.path"><h3>{{ item.label }}</h3><p>{{ item.description }}</p><span>فتح الصفحة ←</span></a>
            }
          }
        </div>
      </section>
    </div>`,
  styles: [`
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .link-card { display: grid; gap: 8px; padding: 18px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: inherit; text-decoration: none; }
    .link-card:hover { border-color: var(--brand-500); }
    .link-card h3 { font-size: 15px; }
    .link-card p { margin: 0; font-size: 12px; color: var(--ink-500); line-height: 1.7; }
    .link-card span { font-size: 12px; font-weight: 800; color: var(--brand-700); }
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .cards { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class OverviewDashboardPage {
  private service = inject(DashboardService);
  auth = inject(AuthService);
  roleLabel = roleLabel;

  data = signal<OverviewDashboard | null>(null);
  loading = signal(false);
  error = signal('');

  links = [
    { path: '/work-tasks', permission: 'ManageWorkTasks', label: 'مهام العمل', description: 'تعريف مهام كل فرع وإسنادها للموظفين' },
    { path: '/users', permission: 'ManageUsers', label: 'الموظفون', description: 'إدارة الموظفين وتعيين أدوارهم وتبعيتهم' },
    { path: '/branches', permission: 'ManageBranches', label: 'الفروع', description: 'إدارة فروع المؤسسة' },
    { path: '/departments', permission: 'ManageDepartments', label: 'الأقسام', description: 'تنظيم الأقسام داخل الفروع' },
    { path: '/offices', permission: 'ManageOffices', label: 'المكاتب', description: 'إدارة المكاتب التابعة للأقسام' },
    { path: '/roles', permission: 'ManageRoles', label: 'الأدوار والصلاحيات', description: 'تحديد الخدمات المسموحة لكل دور' },
    { path: '/vacation-types', permission: 'ManageVacationTypes', label: 'أنواع الإجازات', description: 'إدارة أنواع الإجازات المتاحة' }
  ];

  constructor() {
    this.load();
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.overview().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
