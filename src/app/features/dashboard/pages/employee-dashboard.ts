import { CommonModule } from '@angular/common';
import { DashboardFrame } from '../components/dashboard-frame';
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
  imports: [DashboardFrame, EmptyState, Alert, CommonModule, RouterLink, StatTile, TaskCards],
  styleUrl: '../../../shared/styles/dashboard-layout.scss',
  templateUrl: './employee-dashboard.html'
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
