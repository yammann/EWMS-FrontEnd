import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

/** مفكرتي */
export const TODO_ROUTES: Routes = [
  { path: 'todo-lists', canActivate: [permissionGuard], data: { permission: AppPermission.ViewToDoLists }, loadComponent: () => import('./pages/todo-lists-page').then(m => m.TodoListsPage) },
  { path: 'todo-lists/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewToDoLists, back: '/todo-lists' }, loadComponent: () => import('./pages/todo-list-page').then(m => m.TodoListPage) }
];
