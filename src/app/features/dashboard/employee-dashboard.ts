import { DeviceShortcuts } from '../devices/device-shortcuts';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkTaskService } from '../../core/services/work-task.service';
import { EmployeeDashboard } from '../../core/models/dashboard.models';
import { WorkTaskCard } from '../../core/models/work-task.models';
import { AppNotification } from '../../core/models/notification.models';
import { roleLabel } from '../../core/utils/roles';
import { StatTile, TaskCards } from './dashboard-widgets';

/** لوحة الموظف: مهامه الدورية أولاً، ثم فريقه وآخر إشعاراته */
@Component({
  selector: 'app-employee-dashboard', standalone: true,
  imports: [CommonModule, RouterLink, StatTile, TaskCards, DeviceShortcuts],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">لوحتي</span>
          <h1>مرحباً، {{ data()?.fullName }}</h1>
          @if (data(); as d) {
            <p class="header-sub">{{ label(d.roleName) }}@if (d.branchName) { · {{ d.branchName }} }@if (d.departmentName) { / {{ d.departmentName }} }@if (d.officeName) { / {{ d.officeName }} }</p>
          }
        </div>
        <div class="header-actions">
          @if (data()?.canRequestVacation) { <a class="btn" routerLink="/profile">طلب إجازة</a> }
          <button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="ملخصي">
          <app-stat-tile label="مهامي" [value]="tasks().length" icon="📋" tone="green" hint="المهام الموكلة إليك" />
          <app-stat-tile label="فريقي" [value]="d.team.length" icon="👥" tone="blue" [hint]="d.teamName ? 'زملاء ' + d.teamName : ''" />
          <app-stat-tile label="إشعارات غير مقروءة" [value]="unread()" icon="🔔" tone="purple" />
          <app-stat-tile label="أيام إجازة مدفوعة متبقية" [value]="d.paidDaysLeftThisMonth + ' من ' + d.paidDaysLimitPerMonth" icon="🌴" tone="orange" hint="هذا الشهر" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><span class="panel-kicker">مهامي</span><h2>المهام الموكلة إليك</h2><p>اضغط على المهمة لفتح صفحتها</p></div></div>
          <app-task-cards [tasks]="tasks()" emptyText="لا توجد مهام موكلة إليك بعد" />
        </section>

        <app-device-shortcuts />

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
          } @else { <p class="empty-state">لا يوجد زملاء في فريقك بعد</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإشعارات</h2></div><a class="link" routerLink="/notifications">كل الإشعارات ←</a></div>
          @if (notifications().length) {
            <ul class="note-list">
              @for (n of notifications(); track n.id) {
                <li [class.unread]="!n.isRead"><strong>{{ n.title }}</strong><span>{{ n.message }}</span><small>{{ n.createdAt | date:'yyyy/MM/dd HH:mm' }}</small></li>
              }
            </ul>
          } @else { <p class="empty-state">لا توجد إشعارات</p> }
        </section>
      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل لوحتك…</div>
      }
    </div>`,
  styles: [`
    .note-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .note-list li { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); }
    .note-list li.unread { border-color: var(--brand-200); background: var(--brand-50); }
    .note-list strong { font-size: 13px; color: var(--ink-900); }
    .note-list span { font-size: 12px; color: var(--ink-600); line-height: 1.6; }
    .note-list small { font-size: 11px; color: var(--ink-400); }
  `]
})
export class EmployeeDashboardPage {
  private service = inject(DashboardService);
  private workTasks = inject(WorkTaskService);
  private notificationService = inject(NotificationService);

  data = signal<EmployeeDashboard | null>(null);
  tasks = signal<WorkTaskCard[]>([]);
  notifications = signal<AppNotification[]>([]);
  unread = computed(() => this.notificationService.unreadCount());
  loading = signal(false);
  error = signal('');
  label = roleLabel;

  constructor() {
    this.load();
    this.notificationService.incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.me().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
    this.workTasks.my().subscribe({ next: t => this.tasks.set(t), error: () => this.tasks.set([]) });
    this.notificationService.my().subscribe({ next: n => this.notifications.set(n.slice(0, 5)), error: () => {} });
  }
}
