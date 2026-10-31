import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { DELIVERABLE_TYPE_VIEW, STUDY_ACCESS } from '@core/constants/access';

/**
 * الدراسات: القائمة والأمر بصلاحيات الدراسات (AnyStudyView) وأنواع المخرجات بصلاحيات الأنواع (AnyDeliverableTypeView).
 * `types` يسبق `:id` كي لا يُقرأ كرقم أمر. الحدّ على كل أمر يطبّقه الخادم.
 */
export const STUDIES_ROUTES: Routes = [
  {
    path: 'studies',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: STUDY_ACCESS }, loadComponent: () => import('./pages/studies-page').then(m => m.StudiesPage) },
      { path: 'types', canActivate: [permissionGuard], data: { anyPermission: DELIVERABLE_TYPE_VIEW, back: '/studies' }, loadComponent: () => import('./pages/deliverable-types-page').then(m => m.DeliverableTypesPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: STUDY_ACCESS, back: '/studies' }, loadComponent: () => import('./pages/study-page').then(m => m.StudyPage) }
    ]
  }
];
