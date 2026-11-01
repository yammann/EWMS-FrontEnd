import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { PRICING_ACCESS, PRICING_AGREEMENT_ACCESS } from '@core/constants/access';

/**
 * مكتب التسعير: الطلبات بصلاحيات AnyPricingRequestView والمحاضر بصلاحيات AnyPricingAgreementView.
 * `agreements` يسبق `:id` كي لا يُقرأ كرقم طلب. الحدّ على كل سجل يطبّقه الخادم.
 */
export const PRICING_ROUTES: Routes = [
  {
    path: 'pricing',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: PRICING_ACCESS }, loadComponent: () => import('./pages/pricing-page').then(m => m.PricingPage) },
      { path: 'agreements', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: PRICING_AGREEMENT_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/agreements-page').then(m => m.AgreementsPage) },
      { path: 'agreements/:id', canActivate: [permissionGuard], data: { anyPermission: PRICING_AGREEMENT_ACCESS, back: '/pricing/agreements' }, loadComponent: () => import('./pages/agreement-page').then(m => m.AgreementPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: PRICING_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/pricing-request-page').then(m => m.PricingRequestPage) }
    ]
  }
];
