import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { MainLayout } from '@features/layout';
import { AUTH_ROUTES } from '@features/auth/auth.routes';
import { BRANCHES_ROUTES } from '@features/branches/branches.routes';
import { DASHBOARD_ROUTES } from '@features/dashboard/dashboard.routes';
import { DEPARTMENTS_ROUTES } from '@features/departments/departments.routes';
import { DEVICES_ROUTES } from '@features/devices/devices.routes';
import { MAINTENANCE_PRINT_ROUTES, MAINTENANCE_ROUTES } from '@features/maintenance/maintenance.routes';
import { NOTIFICATIONS_ROUTES } from '@features/notifications/notifications.routes';
import { OFFICES_ROUTES } from '@features/offices/offices.routes';
import { PROFILE_ROUTES } from '@features/profile/profile.routes';
import { ROLES_ROUTES } from '@features/roles/roles.routes';
import { TASK_BOARD_ROUTES } from '@features/task-board/task-board.routes';
import { TODO_ROUTES } from '@features/todo/todo.routes';
import { USERS_ROUTES } from '@features/users/users.routes';
import { VACATIONS_ROUTES, VACATION_PRINT_ROUTES } from '@features/vacations/vacations.routes';
import { WORK_TASKS_ROUTES } from '@features/work-tasks/work-tasks.routes';

/**
 * تعريف المسارات موزّع على الميزات (<feature>.routes.ts)؛ كل صفحة تُحمَّل عند فتحها فقط (loadComponent)،
 * وباقي الصفحات تُحمَّل مسبقاً في الخلفية بعد أول عرض (PreloadAllModules في app.config).
 * الـ guards هنا للواجهة فقط؛ الباكاند يتحقق من كل صلاحية ونطاق بنفسه.
 */
export const routes: Routes = [
  ...AUTH_ROUTES,
  // صفحات الطباعة خارج الإطار العام (بلا سايدبار)
  ...MAINTENANCE_PRINT_ROUTES,
  ...VACATION_PRINT_ROUTES,
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      ...DASHBOARD_ROUTES,
      ...WORK_TASKS_ROUTES,
      ...PROFILE_ROUTES,
      ...NOTIFICATIONS_ROUTES,
      ...TASK_BOARD_ROUTES,
      ...TODO_ROUTES,
      ...DEVICES_ROUTES,
      ...MAINTENANCE_ROUTES,
      ...VACATIONS_ROUTES,
      // إدارة الهيكل والمستخدمين
      ...BRANCHES_ROUTES,
      ...DEPARTMENTS_ROUTES,
      ...OFFICES_ROUTES,
      ...USERS_ROUTES,
      ...ROLES_ROUTES
    ]
  },
  { path: '**', redirectTo: 'login' }
];
