import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { OrganizationHome } from './features/home/organization-home';
import { authGuard } from './core/guards/auth.guard';
import { MainLayout } from './features/layout/main-layout';
import { ProfilePage } from './features/profile/profile-page';
import { VacationReviewPage } from './features/vacations/vacation-review-page';
import { VacationTypesPage } from './features/vacations/vacation-types-page';
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
      { path: '', component: OrganizationHome },
      { path: 'profile', component: ProfilePage },
      { path: 'notifications', component: NotificationsPage },
      { path: 'vacations/review', component: VacationReviewPage, canActivate: [permissionGuard], data: { permission: 'ApproveVacation' } },
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
