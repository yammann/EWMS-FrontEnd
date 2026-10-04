import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { OverviewDashboardPage } from './overview-dashboard';
import { BranchDashboardPage } from './branch-dashboard';
import { DepartmentDashboardPage } from './department-dashboard';
import { OfficeDashboardPage } from './office-dashboard';
import { EmployeeDashboardPage } from './employee-dashboard';

/** الصفحة الرئيسية: أوسع لوحة تسمح بها صلاحيات الدور (مؤسسة ← فرع ← قسم ← مكتب ← شخصية)، وإلا الملف الشخصي */
@Component({
  selector: 'app-dashboard-home', standalone: true,
  imports: [OverviewDashboardPage, BranchDashboardPage, DepartmentDashboardPage, OfficeDashboardPage, EmployeeDashboardPage],
  template: `
    @switch (kind()) {
      @case ('overview') { <app-overview-dashboard /> }
      @case ('branch') { <app-branch-dashboard /> }
      @case ('department') { <app-department-dashboard /> }
      @case ('office') { <app-office-dashboard /> }
      @case ('employee') { <app-employee-dashboard /> }
    }`
})
export class DashboardHome {
  private auth = inject(AuthService);
  private router = inject(Router);
  /** أوسع لوحة يملك المستخدم صلاحيتها (Role-Permission)، وإلا لوحته الشخصية */
  kind = computed(() => {
    const auth = this.auth;
    if (!auth.currentUser()) return 'none';
    if (auth.hasPermission(AppPermission.ViewOrganizationDashboard)) return 'overview';
    if (auth.hasPermission(AppPermission.ViewBranchDashboard)) return 'branch';
    if (auth.hasPermission(AppPermission.ViewDepartmentDashboard)) return 'department';
    if (auth.hasPermission(AppPermission.ViewOfficeDashboard)) return 'office';
    if (auth.hasPermission(AppPermission.ViewMyDashboard)) return 'employee';
    return 'none';
  });

  constructor() {
    // لا لوحة بلا صلاحية: يُحوَّل المستخدم إلى ملفه الشخصي (صفحة الهوية المتاحة لكل مسجّل)
    effect(() => { if (this.kind() === 'none') this.router.navigateByUrl('/profile'); });
  }
}
