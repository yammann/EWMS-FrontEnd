import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, PROJECT_ACCESS } from '@core/constants/access';

/**
 * المشاريع وإضبارتها: القائمة والصفحة بصلاحيات المشاريع (AnyProjectView) والوثائق بصلاحية عرضها؛ حدّ المشاريع المرئية يطبّقه الخادم.
 * `documents` يسبق `:id` كي لا يُقرأ كرقم مشروع.
 */
export const PROJECTS_ROUTES: Routes = [
  {
    path: 'projects',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: PROJECT_ACCESS }, loadComponent: () => import('./pages/projects-page').then(m => m.ProjectsPage) },
      { path: 'documents', canActivate: [permissionGuard], data: { permission: AppPermission.ViewProjectDocuments, back: '/projects' }, loadComponent: () => import('./pages/documents-page').then(m => m.ProjectDocumentsPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: PROJECT_ACCESS, back: '/projects' }, loadComponent: () => import('./pages/project-page').then(m => m.ProjectPage) }
    ]
  }
];
