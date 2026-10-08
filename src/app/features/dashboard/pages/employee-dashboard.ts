import { CommonModule } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import { BranchMapComponent } from '@features/map';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../data-access/dashboard.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { WorkTaskService } from '@features/work-tasks';
import { EmployeeDashboard } from '../data-access/dashboard.models';
import { WorkTaskCard } from '@features/work-tasks';
import { roleLabel } from '@core/utils/roles';
import { TaskCards } from '../components/dashboard-widgets';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { trackRequest } from '@shared/ui/loader';

/** لوحة الموظف: مهامه الدورية أولاً، ثم فريقه (الإشعارات من أيقونة الجرس في الشريط العلوي) */
@Component({
  selector: 'app-employee-dashboard', standalone: true,
  imports: [EmptyState, Alert, CommonModule, RouterLink, StatTile, TaskCards, NgTemplateOutlet, BranchMapComponent],
  styleUrl: '../../../shared/styles/dashboard.scss',
  template: `
    <div class="page">
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
          <span class="eyebrow">لوحتي</span>
          <h1>مرحباً، {{ data()?.fullName }}</h1>
          @if (data(); as d) {
            <p class="header-sub">{{ label(d.roleName) }}@if (d.branchName) { · {{ d.branchName }} }@if (d.departmentName) { / {{ d.departmentName }} }@if (d.officeName) { / {{ d.officeName }} }</p>
          }
        </div>
        <div class="header-actions">
          @if (canRequestVacation()) { <a class="btn" routerLink="/profile">طلب إجازة</a> }
          <button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
    </ng-template>

    <ng-template #bodyTpl>

      <app-alert [message]="error()" />

      @if (data(); as d) {
        <section class="dash-stats" aria-label="ملخصي">
          @if (canMyTasks()) { <app-stat-tile label="مهامي" [value]="tasks().length" icon="📋" tone="green" hint="المهام الموكلة إليك" /> }
          <app-stat-tile label="فريقي" [value]="d.team.length" icon="👥" tone="blue" [hint]="d.teamName ? 'زملاء ' + d.teamName : ''" />
          @if (canNotifications()) { <app-stat-tile label="إشعارات غير مقروءة" [value]="unread()" icon="🔔" tone="purple" /> }
          <app-stat-tile label="أيام إجازة مدفوعة متبقية" [value]="d.paidDaysLeftThisMonth + ' من ' + d.paidDaysLimitPerMonth" icon="🌴" tone="orange" hint="هذا الشهر" />
        </section>

        @if (canMyTasks()) {
        <section class="panel">
          <div class="panel-heading"><div><span class="panel-kicker">مهامي</span><h2>المهام الموكلة إليك</h2><p>اضغط على المهمة لفتح صفحتها</p></div></div>
          <app-task-cards [tasks]="tasks()" emptyText="لا توجد مهام موكلة إليك بعد" />
        </section>
        }


        <section class="panel">
          <div class="panel-heading"><div><h2>فريقي</h2>@if (d.teamName) { <p>زملاؤك في {{ d.teamName }}</p> }</div></div>
          @if (d.team.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>الدور</th><th>البريد الإلكتروني</th></tr></thead>
              <tbody>
                @for (m of d.team; track m.email) {
                  <tr><td><strong class="cell-link">{{ m.fullName }}</strong></td><td>{{ label(m.roleName) }}</td><td dir="ltr">{{ m.email }}</td></tr>
                }
              </tbody>
            </table></div>
          } @else { <app-empty-state>لا يوجد زملاء في فريقك بعد</app-empty-state> }
        </section>

      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحتك…</div>
      }
    </ng-template>`
})
export class EmployeeDashboardPage {
  private service = inject(DashboardService);
  private workTasks = inject(WorkTaskService);
  private notificationService = inject(NotificationService);
  private auth = inject(AuthService);
  canRequestVacation = computed(() => this.auth.hasPermission(AppPermission.CreateVacation));
  canMyTasks = computed(() => this.auth.hasPermission(AppPermission.ViewMyWorkTasks));
  canNotifications = computed(() => this.auth.hasPermission(AppPermission.ViewNotifications));

  data = signal<EmployeeDashboard | null>(null);
  tasks = signal<WorkTaskCard[]>([]);
  unread = computed(() => this.notificationService.unreadCount());
  loading = signal(false);
  error = signal('');
  label = roleLabel;

  /** خريطة فرعه في لوحتي: لمن يملك ViewBranchMap (مدير النظام يراها في لوحة المؤسسة) */
  showMap = computed(() => this.auth.hasPermission(AppPermission.ViewBranchMap));

  constructor() {
    this.load();
    this.notificationService.incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    trackRequest(this.service.me(), this.loading, this.error, d => { this.data.set(d); });
    if (this.canMyTasks()) this.workTasks.my().subscribe({ next: t => this.tasks.set(t), error: () => this.tasks.set([]) });
  }
}
