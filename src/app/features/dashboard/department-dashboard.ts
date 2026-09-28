import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkTaskService } from '../../core/services/work-task.service';
import { DepartmentDashboard } from '../../core/models/dashboard.models';
import { WorkTaskCard } from '../../core/models/work-task.models';
import { ActivityList, StatTile, TaskCards, TaskDistributionTable } from './dashboard-widgets';

/** لوحة رئيس القسم — ويفتحها رئيس الفرع (أقسام فرعه) و SuperAdmin عبر /dashboard/department/:id */
@Component({
  selector: 'app-department-dashboard', standalone: true,
  imports: [RouterLink, StatTile, TaskCards, TaskDistributionTable, ActivityList],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      @if (data(); as d) {
        @if (role() === 'SuperAdmin') {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">المؤسسة</a><span>/</span><a [routerLink]="['/dashboard/branch', d.branchId]">{{ d.branchName }}</a><span>/</span><span>{{ d.departmentName }}</span></nav>
        } @else if (role() === 'BranchManager') {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">{{ d.branchName }}</a><span>/</span><span>{{ d.departmentName }}</span></nav>
        }
      }
      <header class="page-header">
        <div>
          <span class="eyebrow">لوحة رئيس القسم</span>
          <h1>{{ data()?.departmentName || 'القسم' }}</h1>
          @if (data(); as d) { <p class="header-sub">{{ d.branchName }}@if (d.managerNames) { · رئيس القسم: {{ d.managerNames }} }</p> }
        </div>
        <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="إحصائيات القسم">
          <app-stat-tile label="المكاتب" [value]="d.officesCount" icon="🚪" tone="purple" />
          <app-stat-tile label="الموظفون" [value]="d.employeesCount" icon="👥" tone="green" />
          <app-stat-tile label="مهام العمل" [value]="d.tasksCount" icon="📋" tone="blue" hint="المسنَدة لموظفي القسم" />
          <app-stat-tile label="موظفون بلا مهام" [value]="d.employeesWithoutTasks" icon="🧩" tone="orange" [alert]="d.employeesWithoutTasks > 0" />
        </section>

        @if (isOwn()) {
          <section class="panel">
            <div class="panel-heading"><div><span class="panel-kicker">مهامي</span><h2>المهام المسنَدة إليك</h2></div></div>
            <app-task-cards [tasks]="myTasks()" emptyText="لا توجد مهام مسنَدة إليك" />
          </section>
        }

        <section class="panel">
          <div class="panel-heading"><div><h2>مكاتب القسم</h2><p>اضغط على المكتب لعرض لوحته</p></div></div>
          @if (d.offices.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>المكتب</th><th>رئيس المكتب</th><th>الموظفون</th><th>مسؤولون عن مهام</th></tr></thead>
              <tbody>
                @for (o of d.offices; track o.id) {
                  <tr>
                    <td><a class="cell-link" [routerLink]="['/dashboard/office', o.id]">{{ o.name }}</a></td>
                    <td [class.muted-cell]="!o.managerNames">{{ o.managerNames || 'لم يُعيَّن' }}</td>
                    <td class="num">{{ o.employeesCount }}</td>
                    <td class="num">{{ o.employeesWithTasks }} من {{ o.employeesCount }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="empty-state">لا توجد مكاتب في هذا القسم</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>توزيع مهام العمل</h2><p>من المسؤول عن كل مهمة داخل القسم</p></div></div>
          <app-task-distribution [items]="d.taskDistribution" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإسناد المهام في القسم</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

        @if (isOwn()) {
          <a class="jump" routerLink="/vacations/stats">
            <div><strong>إحصائيات إجازات القسم</strong><span>من في إجازة، الطلبات بانتظار موافقتك، والإجازات حسب النوع</span></div>
            <span class="go">فتح ←</span>
          </a>
        }
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحة القسم…</div>
      }
    </div>`
})
export class DepartmentDashboardPage {
  private service = inject(DashboardService);
  private tasks = inject(WorkTaskService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  data = signal<DepartmentDashboard | null>(null);
  myTasks = signal<WorkTaskCard[]>([]);
  loading = signal(false);
  error = signal('');
  role = computed(() => this.auth.currentUser()?.role ?? '');
  /** لوحتي أنا (الصفحة الرئيسية) وليست قسماً أتصفحه */
  isOwn = signal(true);
  private id: number | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id = p.get('id') ? Number(p.get('id')) : null;
      this.isOwn.set(this.id === null);
      this.load();
    });
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.department(this.id).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
    if (this.isOwn()) this.tasks.my().subscribe({ next: t => this.myTasks.set(t), error: () => this.myTasks.set([]) });
  }
}
