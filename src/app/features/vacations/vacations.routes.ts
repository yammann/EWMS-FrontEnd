import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { APPROVE_VACATIONS, AppPermission, MANAGE_VACATION_TYPES, VACATION_STATS } from '@core/constants/access';

/** نموذج طلب الإجازة الورقي — خارج الإطار العام */
export const VACATION_PRINT_ROUTES: Routes = [
  {
    path: 'vacations/print/:id', canActivate: [permissionGuard], data: { permission: AppPermission.PrintVacation, back: '/profile' },
    loadComponent: () => import('./pages/vacation-print-page').then(m => m.VacationPrintPage)
  }
];

export const VACATIONS_ROUTES: Routes = [
  {
    path: 'vacations/review', canActivate: [permissionGuard], data: { anyPermission: APPROVE_VACATIONS },
    loadComponent: () => import('./pages/vacation-review-page').then(m => m.VacationReviewPage)
  },
  {
    path: 'vacations/stats', canActivate: [permissionGuard], data: { anyPermission: VACATION_STATS },
    loadComponent: () => import('./pages/vacation-stats-page').then(m => m.VacationStatsPage)
  },
  {
    path: 'vacation-types', canActivate: [permissionGuard], data: { anyPermission: MANAGE_VACATION_TYPES },
    loadComponent: () => import('./pages/vacation-types-page').then(m => m.VacationTypesPage)
  },
  {
    path: 'vacations/holidays', canActivate: [permissionGuard], data: { permission: AppPermission.ViewHolidays },
    loadComponent: () => import('./pages/holidays-page').then(m => m.HolidaysPage)
  }
];
