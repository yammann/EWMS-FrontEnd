import { DashboardFrame } from '../components/dashboard-frame';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardService } from '../data-access/dashboard.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { BranchDashboard } from '../data-access/dashboard.models';
import { ActivityList, TaskCards, TaskDistributionTable } from '../components/dashboard-widgets';
import { StatTile } from '@shared/ui/stat-tile';
import { AppPermission } from '@core/constants/access';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { latestRequest } from '@shared/ui/track-request';

/** لوحة رئيس الفرع (إحصائيات عامة للفرع) — ويفتحها SuperAdmin لأي فرع عبر /dashboard/branch/:id */
@Component({
  selector: 'app-branch-dashboard', standalone: true,
  imports: [DashboardFrame, EmptyState, Alert, RouterLink, StatTile, TaskCards, TaskDistributionTable, ActivityList],
  styleUrl: '../../../shared/styles/dashboard-layout.scss',
  templateUrl: './branch-dashboard.html'
})
export class BranchDashboardPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  data = signal<BranchDashboard | null>(null);
  loading = signal(false);
  error = signal('');
  /** يتصفح الفرع من مستوى المؤسسة (فتات المسار يبدأ بالمؤسسة) */
  isAdmin = computed(() => this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));
  private own = signal(true);
  /** خريطة فرعه: لمن يملك ViewBranchMap وهو يتصفح لوحة فرعه (مدير النظام يراها في لوحة المؤسسة) */
  showMap = computed(() => this.own() && this.auth.hasPermission(AppPermission.ViewBranchMap));
  private id: number | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id = p.get('id') ? Number(p.get('id')) : null;
      this.own.set(this.id === null);
      this.load();
    });
    // تحديث تلقائي عند وصول إشعار — بدون إعادة تحميل الصفحة
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.latest(this.service.branch(this.id), this.loading, this.error, d => { this.data.set(d); });
  }
}
