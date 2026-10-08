import { AppPermission } from '@core/constants/access';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '@features/dashboard';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { LookupsService } from '@core/services/lookups.service';
import { VacationStats } from '@features/dashboard';
import { Branch } from '@core/models/ewms.models';
import { ActionsTable, CountBars, VacationRows } from '@features/dashboard';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/**
 * إحصائيات الإجازات للرؤساء — صفحة مستقلة عن لوحة المتابعة (الإجازات ميزة واحدة من التطبيق).
 * النطاق من الباكاند: رئيس الفرع ← فرعه، رئيس القسم ← قسمه، رئيس المكتب ← مكتبه، SuperAdmin ← الكل أو فرع يختاره.
 */
@Component({
  selector: 'app-vacation-stats', standalone: true,
  imports: [Alert, RouterLink, StatTile, VacationRows, ActionsTable, CountBars],
  styleUrl: '../../../shared/styles/dashboard.scss',
  templateUrl: './vacation-stats-page.html'
})
export class VacationStatsPage {
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  private lookups = inject(LookupsService);

  data = signal<VacationStats | null>(null);
  branches = signal<Branch[]>([]);
  branchId = signal(0);
  loading = signal(false);
  error = signal('');
  isAdmin = computed(() => this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));
  canReview = computed(() => this.auth.canReviewVacations());

  constructor() {
    this.load();
    if (this.isAdmin()) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => {} });
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  selectBranch(id: number) { this.branchId.set(id); this.load(); }

  load() {
    trackRequest(this.service.vacations(this.branchId() || null), this.loading, this.error, d => { this.data.set(d); });
  }
}
