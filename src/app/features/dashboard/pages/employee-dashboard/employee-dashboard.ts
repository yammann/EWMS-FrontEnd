import { CommonModule } from '@angular/common';
import { DashboardFrame } from '../../components/dashboard-frame';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../data-access/dashboard.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { EmployeeDashboard } from '../../data-access/dashboard.models';
import { roleLabel } from '@core/utils/roles';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { latestRequest } from '@shared/ui/track-request';

/** لوحة الموظف: ملخصه ثم فريقه (الإشعارات من أيقونة الجرس في الشريط العلوي) */
@Component({
  selector: 'app-employee-dashboard',
  imports: [DashboardFrame, EmptyState, Alert, CommonModule, RouterLink, StatTile],
  styleUrl: '../../../../shared/styles/dashboard-layout.scss',
  templateUrl: './employee-dashboard.html'
})
export class EmployeeDashboardPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(DashboardService);
  private notificationService = inject(NotificationService);
  private auth = inject(AuthService);
  canRequestVacation = computed(() => this.auth.hasPermission(AppPermission.CreateVacation));
  canNotifications = computed(() => this.auth.hasPermission(AppPermission.ViewNotifications));

  data = signal<EmployeeDashboard | null>(null);
  unread = computed(() => this.notificationService.unreadCount());
  loading = signal(false);
  error = signal('');
  label = roleLabel;

  /** خريطة فرعه في لوحتي: لمن يملك ViewBranchMap (مدير النظام يراها في لوحة المؤسسة) */
  showMap = computed(() => this.auth.hasPermission(AppPermission.ViewBranchMap));

  constructor() {
    this.load();
    this.notificationService.changes$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.latest(this.service.me(), this.loading, this.error, d => { this.data.set(d); });
  }
}
