import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardHome } from './features/dashboard/dashboard-home';
import { BranchDashboardPage } from './features/dashboard/branch-dashboard';
import { DepartmentDashboardPage } from './features/dashboard/department-dashboard';
import { OfficeDashboardPage } from './features/dashboard/office-dashboard';
import { WorkTasksPage } from './features/work-tasks/work-tasks-page';
import { TaskPlaceholderPage } from './features/work-tasks/task-placeholder-page';
import { authGuard } from './core/guards/auth.guard';
import { MainLayout } from './features/layout/main-layout';
import { ProfilePage } from './features/profile/profile-page';
import { VacationReviewPage } from './features/vacations/vacation-review-page';
import { VacationTypesPage } from './features/vacations/vacation-types-page';
import { VacationStatsPage } from './features/vacations/vacation-stats-page';
import { LEADER_ROLES } from './core/utils/roles';
import { TaskBoardPage } from './features/task-board/task-board-page';
import { OfficesPage } from './features/offices/offices-page';
import { permissionGuard } from './core/guards/permission.guard';
import { DepartmentsPage } from './features/departments/departments-page';
import { BranchesPage } from './features/branches/branches-page';
import { UsersPage } from './features/users/users-page';
import { RolesPage } from './features/roles/roles-page';
import { NotificationsPage } from './features/notifications/notifications-page';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // لوحة المتابعة حسب الدور، والتنقل بين لوحات الفرع/القسم/المكتب (الباكاند يتحقق من النطاق)
      { path: '', component: DashboardHome },
      { path: 'dashboard/branch/:id', component: BranchDashboardPage },
      { path: 'dashboard/department/:id', component: DepartmentDashboardPage },
      { path: 'dashboard/office/:id', component: OfficeDashboardPage },
      // صفحة مهمة العمل — حالياً "جاري العمل عليها" لكل المهام
      { path: 'tasks/:id', component: TaskPlaceholderPage },
      { path: 'work-tasks', component: WorkTasksPage, canActivate: [permissionGuard], data: { permission: 'ManageWorkTasks' } },
      { path: 'profile', component: ProfilePage },
      { path: 'notifications', component: NotificationsPage },
      // لوحة المهام المُسندة (لكل المستخدمين: الموظف يستقبل، والرؤساء يُسندون ويتابعون)
      { path: 'task-board', component: TaskBoardPage },
      { path: 'vacations/review', component: VacationReviewPage, canActivate: [permissionGuard], data: { permission: 'ApproveVacation' } },
      { path: 'vacations/stats', component: VacationStatsPage, canActivate: [permissionGuard], data: { roles: LEADER_ROLES } },
      { path: 'vacation-types', component: VacationTypesPage, canActivate: [permissionGuard], data: { permission: 'ManageVacationTypes' } },
      { path: 'offices', component: OfficesPage, canActivate: [permissionGuard], data: { permission: 'ManageOffices' } },
      { path: 'departments', component: DepartmentsPage, canActivate: [permissionGuard], data: { permission: 'ManageDepartments' } },
      { path: 'branches', component: BranchesPage, canActivate: [permissionGuard], data: { permission: 'ManageBranches' } },
      { path: 'users', component: UsersPage, canActivate: [permissionGuard], data: { permission: 'ManageUsers' } },
      { path: 'roles', component: RolesPage, canActivate: [permissionGuard], data: { permission: 'ManageRoles' } }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
