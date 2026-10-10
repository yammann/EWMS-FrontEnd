import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission } from '@core/constants/access';

export const NOTIFICATIONS_ROUTES: Routes = [
  { path: 'notifications', canActivate: [permissionGuard], data: { permission: AppPermission.ViewNotifications }, loadComponent: () => import('./pages/notifications-page').then(m => m.NotificationsPage) }
];
