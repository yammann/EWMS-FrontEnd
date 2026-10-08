import { CommonModule } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import { BranchMapComponent } from '@features/map';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardService } from '../data-access/dashboard.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { NotificationService } from '@core/services/notification.service';
import { WorkTaskService } from '@features/work-tasks';
import { OfficeDashboard } from '../data-access/dashboard.models';
import { WorkTaskCard } from '@features/work-tasks';
import { roleLabel } from '@core/utils/roles';
import { ActivityList, TaskCards, TaskDistributionTable } from '../components/dashboard-widgets';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';

/** لوحة رئيس المكتب */
@Component({
  selector: 'app-office-dashboard', standalone: true,
  imports: [EmptyState, Alert, CommonModule, RouterLink, StatTile, TaskCards, TaskDistributionTable, ActivityList, NgTemplateOutlet, BranchMapComponent],
  styleUrl: '../../../shared/styles/dashboard.scss',
  template: `
    <div class="page">
      @if (data(); as d) {
        @if (seesOrganization()) {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">المؤسسة</a><span>/</span><a [routerLink]="['/dashboard/branch', d.branchId]">{{ d.branchName }}</a><span>/</span><a [routerLink]="['/dashboard/department', d.departmentId]">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        } @else if (isBranchPosition()) {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">{{ d.branchName }}</a><span>/</span><a [routerLink]="['/dashboard/department', d.departmentId]">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        } @else if (isDepartmentPosition()) {
          <nav class="crumbs" aria-label="المسار"><a routerLink="/">{{ d.departmentName }}</a><span>/</span><span>{{ d.officeName }}</span></nav>
        }
      }
      @if (showMap()) {
        <!-- خريطة فرعه مثبّتة في رأس الصفحة (لمن يملك ViewBranchMap) — الصفحة تنزلق فوقها أثناء السكرول -->
        <app-branch-map>
          <header class="page-header"><ng-container *ngTemplateOutlet="headerTpl" /></header>
          <ng-container *ngTemplateOutlet="bodyTpl" />
        </app-branch-map>
      } @else {
        <header class="page-header"><ng-container *ngTemplateOutlet="headerTpl" /></header>
        <ng-container *ngTemplateOutlet="bodyTpl" />
      }
    </div>

    <ng-template #headerTpl>
        <div>
          <span class="eyebrow">لوحة رئيس المكتب</span>
          <h1>{{ data()?.officeName || 'المكتب' }}</h1>
          @if (data(); as d) { <p class="header-sub">{{ d.branchName }} / {{ d.departmentName }}@if (d.managerNames) { · رئيس المكتب: {{ d.managerNames }} }</p> }
        </div>
        <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
    </ng-template>

    <ng-template #bodyTpl>

      <app-alert [message]="error()" />

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
          } @else { <app-empty-state>لا يوجد موظفون في هذا المكتب</app-empty-state> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>توزيع مهام العمل</h2><p>من المسؤول عن كل مهمة داخل المكتب</p></div></div>
          <app-task-distribution [items]="d.taskDistribution" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإسناد المهام في المكتب</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحة المكتب…</div>
      }
    </ng-template>`
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
  isOwn = signal(true);
  label = roleLabel;
  private id: number | null = null;

  /** يتصفح الهيكل من مستوى المؤسسة (يبدأ مسار التنقل بالمؤسسة) */
  seesOrganization() { return this.auth.hasPermission(AppPermission.ViewOrganizationDashboard); }
  /** من أي لوحة وصل للمكتب (يحدد بداية المسار): لوحة الفرع أو لوحة القسم */
  isBranchPosition() { return this.auth.hasPermission(AppPermission.ViewBranchDashboard); }
  isDepartmentPosition() { return this.auth.hasPermission(AppPermission.ViewDepartmentDashboard); }

  /** خريطة فرعه في لوحتي: لمن يملك ViewBranchMap (مدير النظام يراها في لوحة المؤسسة) */
  showMap = computed(() => this.isOwn() && this.auth.hasPermission(AppPermission.ViewBranchMap));

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
