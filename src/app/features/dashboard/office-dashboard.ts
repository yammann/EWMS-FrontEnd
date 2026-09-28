import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkTaskService } from '../../core/services/work-task.service';
import { OfficeDashboard } from '../../core/models/dashboard.models';
import { WorkTaskCard } from '../../core/models/work-task.models';
import { roleLabel } from '../../core/utils/roles';
import { ActivityList, StatTile, TaskCards, TaskDistributionTable } from './dashboard-widgets';

/** لوحة رئيس المكتب */
@Component({
  selector: 'app-office-dashboard', standalone: true,
  imports: [CommonModule, RouterLink, StatTile, TaskCards, TaskDistributionTable, ActivityList],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      @if (data(); as d) {
        @if (role() === 'SuperAdmin') {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">المؤسسة</a><span>/</span><a [routerLink]="['/dashboard/branch', d.branchId]">{{ d.branchName }}</a><span>/</span><a [routerLink]="['/dashboard/department', d.departmentId]">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        } @else if (role() === 'BranchManager') {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">{{ d.branchName }}</a><span>/</span><a [routerLink]="['/dashboard/department', d.departmentId]">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        } @else if (role() === 'Manager') {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        }
      }
      <header class="page-header">
        <div>
          <span class="eyebrow">لوحة رئيس المكتب</span>
          <h1>{{ data()?.officeName || 'المكتب' }}</h1>
          @if (data(); as d) { <p class="header-sub">{{ d.branchName }} / {{ d.departmentName }}@if (d.managerNames) { · رئيس المكتب: {{ d.managerNames }} }</p> }
        </div>
        <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="إحصائيات المكتب">
          <app-stat-tile label="الموظفون" [value]="d.employeesCount" icon="👥" tone="green" />
          <app-stat-tile label="مهام العمل" [value]="d.tasksCount" icon="📋" tone="blue" hint="المسنَدة لموظفي المكتب" />
          <app-stat-tile label="مسؤولون عن مهام" [value]="d.employeesWithTasks" icon="✅" tone="purple" />
          <app-stat-tile label="موظفون بلا مهام" [value]="d.employeesWithoutTasks" icon="🧩" tone="orange" [alert]="d.employeesWithoutTasks > 0" />
        </section>

        @if (isOwn()) {
          <section class="panel">
            <div class="panel-heading"><div><span class="panel-kicker">مهامي</span><h2>المهام المسنَدة إليك</h2></div></div>
            <app-task-cards [tasks]="myTasks()" emptyText="لا توجد مهام مسنَدة إليك" />
          </section>
        }

        <section class="panel">
          <div class="panel-heading"><div><h2>موظفو المكتب</h2><p>الأدوار والمهام الموكلة لكل موظف</p></div></div>
          @if (d.members.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>الموظف</th><th>الدور</th><th>البريد الإلكتروني</th><th>مهام العمل</th><th>تاريخ الانضمام</th></tr></thead>
              <tbody>
                @for (m of d.members; track m.userId) {
                  <tr>
                    <td><strong class="cell-link">{{ m.fullName }}</strong></td>
                    <td>{{ label(m.roleName) }}</td>
                    <td dir="ltr">{{ m.email }}</td>
                    <td>
                      @if (m.taskNames.length) { <div class="tag-list">@for (t of m.taskNames; track t) { <span class="tag">{{ t }}</span> }</div> }
                      @else { <span class="muted-cell">لا توجد مهام</span> }
                    </td>
                    <td class="num">{{ m.joinedAt | date:'yyyy/MM/dd' }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="empty-state">لا يوجد موظفون في هذا المكتب</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>توزيع مهام العمل</h2><p>من المسؤول عن كل مهمة داخل المكتب</p></div></div>
          <app-task-distribution [items]="d.taskDistribution" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإسناد المهام في المكتب</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

        @if (isOwn()) {
          <a class="jump" routerLink="/vacations/stats">
            <div><strong>إحصائيات إجازات المكتب</strong><span>من في إجازة وطلبات موظفي المكتب قيد الموافقة</span></div>
            <span class="go">فتح ←</span>
          </a>
        }
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحة المكتب…</div>
      }
    </div>`
})
export class OfficeDashboardPage {
  private service = inject(DashboardService);
  private tasks = inject(WorkTaskService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  data = signal<OfficeDashboard | null>(null);
  myTasks = signal<WorkTaskCard[]>([]);
  loading = signal(false);
  error = signal('');
  role = computed(() => this.auth.currentUser()?.role ?? '');
  isOwn = signal(true);
  label = roleLabel;
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
    this.service.office(this.id).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
    if (this.isOwn()) this.tasks.my().subscribe({ next: t => this.myTasks.set(t), error: () => this.myTasks.set([]) });
  }
}
