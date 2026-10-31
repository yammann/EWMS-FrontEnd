import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { CONTRACT_ACCESS, CONTRACTOR_VIEW, CRITERION_VIEW } from '@core/constants/access';

/**
 * العقود: القائمة والعقد بصلاحيات العقود (AnyContractView)، والمقاولون (AnyContractorView) والمعايير (AnyEvaluationCriterionView) بصلاحياتها.
 * `contractors` و`criteria` تسبقان `:id` كي لا تُقرآ كرقم عقد. الحدّ على كل عقد يطبّقه الخادم.
 */
export const CONTRACTS_ROUTES: Routes = [
  {
    path: 'contracts',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: CONTRACT_ACCESS }, loadComponent: () => import('./pages/contracts-page').then(m => m.ContractsPage) },
      { path: 'contractors', canActivate: [permissionGuard], data: { anyPermission: CONTRACTOR_VIEW, back: '/contracts' }, loadComponent: () => import('./pages/contractors-page').then(m => m.ContractorsPage) },
      { path: 'criteria', canActivate: [permissionGuard], data: { anyPermission: CRITERION_VIEW, back: '/contracts' }, loadComponent: () => import('./pages/criteria-page').then(m => m.CriteriaPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: CONTRACT_ACCESS, back: '/contracts' }, loadComponent: () => import('./pages/contract-page').then(m => m.ContractPage) }
    ]
  }
];
