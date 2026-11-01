import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { PRICING_ACCESS, PRICING_AGREEMENT_ACCESS, REFERENCE_PRICE_ACCESS, RECONCILIATION_ACCESS } from '@core/constants/access';

/**
 * مكتب التسعير: الطلبات بصلاحيات AnyPricingRequestView والمحاضر بصلاحيات AnyPricingAgreementView.
 * الأسعار المرجعية بصلاحيات AnyReferencePriceView. `agreements` و`reference-prices` و`reconciliations` تسبقان `:id` كي لا تُقرآ كرقم طلب. الحدّ على كل سجل يطبّقه الخادم.
 */
export const PRICING_ROUTES: Routes = [
  {
    path: 'pricing',
    children: [
      { path: '', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: PRICING_ACCESS }, loadComponent: () => import('./pages/pricing-page').then(m => m.PricingPage) },
      { path: 'agreements', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: PRICING_AGREEMENT_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/agreements-page').then(m => m.AgreementsPage) },
      { path: 'agreements/:id', canActivate: [permissionGuard], data: { anyPermission: PRICING_AGREEMENT_ACCESS, back: '/pricing/agreements' }, loadComponent: () => import('./pages/agreement-page').then(m => m.AgreementPage) },
      { path: 'reference-prices', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: REFERENCE_PRICE_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/reference-prices-page').then(m => m.ReferencePricesPage) },
      { path: 'reference-prices/:id', canActivate: [permissionGuard], data: { anyPermission: REFERENCE_PRICE_ACCESS, back: '/pricing/reference-prices' }, loadComponent: () => import('./pages/reference-price-page').then(m => m.ReferencePricePage) },
      { path: 'reconciliations', pathMatch: 'full', canActivate: [permissionGuard], data: { anyPermission: RECONCILIATION_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/reconciliations-page').then(m => m.ReconciliationsPage) },
      { path: 'reconciliations/:id', canActivate: [permissionGuard], data: { anyPermission: RECONCILIATION_ACCESS, back: '/pricing/reconciliations' }, loadComponent: () => import('./pages/reconciliation-page').then(m => m.ReconciliationPage) },
      { path: ':id', canActivate: [permissionGuard], data: { anyPermission: PRICING_ACCESS, back: '/pricing' }, loadComponent: () => import('./pages/pricing-request-page').then(m => m.PricingRequestPage) }
    ]
  }
];
