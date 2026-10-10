import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, WORK_TASK_VIEW } from '@core/constants/access';

/** مهام العمل: صفحة كل مهمة "جاري العمل عليها" حالياً، والإدارة للسوبر ادمن */
export const WORK_TASKS_ROUTES: Routes = [
  { path: 'tasks/:id', canActivate: [permissionGuard], data: { anyPermission: WORK_TASK_VIEW, back: '/' }, loadComponent: () => import('./pages/task-placeholder-page').then(m => m.TaskPlaceholderPage) },
  { path: 'work-tasks', canActivate: [permissionGuard], data: { permission: AppPermission.ViewWorkTasks }, loadComponent: () => import('./pages/work-tasks-page').then(m => m.WorkTasksPage) }
];
