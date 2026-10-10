import { DashboardFrame } from '../components/dashboard-frame';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../data-access/dashboard.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { NotificationService } from '@core/services/notification.service';
import { OverviewDashboard } from '../data-access/dashboard.models';
import { ActivityList } from '../components/dashboard-widgets';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { trackRequest } from '@shared/ui/loader';

/** لوحة مدير النظام: إحصائيات عامة للمؤسسة + الدخول لأي فرع (صفحات الإدارة من السايدبار) */
@Component({
  selector: 'app-overview-dashboard', standalone: true,
  imports: [DashboardFrame, EmptyState, Alert, RouterLink, StatTile, ActivityList],
  styleUrl: '../../../shared/styles/dashboard-layout.scss',
  templateUrl: './overview-dashboard.html'
})
export class OverviewDashboardPage {
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  showMap = computed(() => this.auth.hasPermission(AppPermission.ViewBranchMap));

  data = signal<OverviewDashboard | null>(null);
  loading = signal(false);
  error = signal('');


  constructor() {
    this.load();
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    trackRequest(this.service.overview(), this.loading, this.error, d => { this.data.set(d); });
  }
}
