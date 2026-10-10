import { CommonModule } from '@angular/common';
import { DashboardFrame } from '../components/dashboard-frame';
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
import { trackRequest } from '@shared/ui/loader';

/** لوحة رئيس المكتب */
@Component({
  selector: 'app-office-dashboard', standalone: true,
  imports: [DashboardFrame, EmptyState, Alert, CommonModule, RouterLink, StatTile, TaskCards, TaskDistributionTable, ActivityList],
  styleUrl: '../../../shared/styles/dashboard-layout.scss',
  templateUrl: './office-dashboard.html'
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
    trackRequest(this.service.office(this.id), this.loading, this.error, d => { this.data.set(d); });
    if (this.isOwn()) this.tasks.my().subscribe({ next: t => this.myTasks.set(t), error: () => this.myTasks.set([]) });
  }
}
