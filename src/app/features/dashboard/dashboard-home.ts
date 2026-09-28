import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { dashboardKindFor } from '../../core/utils/roles';
import { OverviewDashboardPage } from './overview-dashboard';
import { BranchDashboardPage } from './branch-dashboard';
import { DepartmentDashboardPage } from './department-dashboard';
import { OfficeDashboardPage } from './office-dashboard';
import { EmployeeDashboardPage } from './employee-dashboard';

/** الصفحة الرئيسية: لوحة المتابعة المناسبة لدور المستخدم */
@Component({
  selector: 'app-dashboard-home', standalone: true,
  imports: [OverviewDashboardPage, BranchDashboardPage, DepartmentDashboardPage, OfficeDashboardPage, EmployeeDashboardPage],
  template: `
    @switch (kind()) {
      @case ('overview') { <app-overview-dashboard /> }
      @case ('branch') { <app-branch-dashboard /> }
      @case ('department') { <app-department-dashboard /> }
      @case ('office') { <app-office-dashboard /> }
      @default { <app-employee-dashboard /> }
    }`
})
export class DashboardHome {
  private auth = inject(AuthService);
  kind = computed(() => dashboardKindFor(this.auth.currentUser()?.role));
}
