import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, TASK_ASSIGN } from '@core/constants/access';

/** لوحة المهام المُسندة: تحتاج ViewTaskBoard، والإسناد والمتابعة بصلاحيات AssignTaskTo* / HandleUnitTasks */
export const TASK_BOARD_ROUTES: Routes = [
  { path: 'task-board', canActivate: [permissionGuard], data: { permission: AppPermission.ViewTaskBoard }, loadComponent: () => import('./pages/task-board-page').then(m => m.TaskBoardPage) },
  { path: 'task-board/recurring', canActivate: [permissionGuard], data: { anyPermission: TASK_ASSIGN, back: '/task-board' }, loadComponent: () => import('./pages/recurring-page').then(m => m.RecurringTasksPage) },
  { path: 'task-board/stats', canActivate: [permissionGuard], data: { permission: AppPermission.ViewTaskStats, back: '/task-board' }, loadComponent: () => import('./pages/task-stats-page').then(m => m.TaskStatsPage) }
];
