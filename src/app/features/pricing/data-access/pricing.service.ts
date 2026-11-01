import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName, PRICING_ACCESS, PRICING_AGREEMENT_ACCESS } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  Agreement, AgreementFilter, AgreementInput, AgreementListItem, PricingAccess, PricingAssignee, PricingFilter, PricingListItem, PricingOfferInput, PricingRequest, PricingRequestInput
} from './pricing.models';

/** مكتب التسعير (api/PricingRequests و api/PricingAgreements) — الحدود يطبّقها الخادم، ويعيد الطلب كاملاً بأعلام الأزرار وصفوف المقارنة بعد كل عملية */
@Injectable({ providedIn: 'root' })
export class PricingService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يحسب ما يحق لي على كل طلب (canEdit، canDecide…) */
  access = computed<PricingAccess>(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canView: this.auth.hasAnyPermission(PRICING_ACCESS),
      canRegister: has(AppPermission.RegisterPricingRequest),
      canAssign: has(AppPermission.AssignPricingRequest),
      canPrepareOffers: has(AppPermission.PreparePricingOffers),
      canApprove: has(AppPermission.ApprovePricingRequest),
      canSendResult: has(AppPermission.SendPricingResult),
      canViewAgreements: this.auth.hasAnyPermission(PRICING_AGREEMENT_ACCESS),
      canPrepareAgreement: has(AppPermission.PreparePricingAgreement),
      canApproveAgreement: has(AppPermission.ApprovePricingAgreement),
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard)
    };
  });

  // ─────────── الطلبات ───────────
  search(f: PricingFilter) {
    const q = new URLSearchParams();
    if (f.branchId) q.set('branchId', String(f.branchId));
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.status) q.set('status', String(f.status));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.overdueOnly) q.set('overdueOnly', 'true');
    if (f.mine) q.set('mine', 'true');
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<PricingListItem>>(`/PricingRequests/Search?${q}`);
  }
  get(id: number) { return this.api.get<PricingRequest>(`/PricingRequests/Get/${id}`); }
  assignees(branchId: number | null = null) { return this.api.get<PricingAssignee[]>(`/PricingRequests/Assignees${branchId ? `?branchId=${branchId}` : ''}`); }
  create(v: PricingRequestInput) { return this.api.post<PricingRequest>('/PricingRequests/Create', v); }
  update(id: number, v: PricingRequestInput) { return this.api.put<PricingRequest>(`/PricingRequests/Update/${id}`, v); }
  assign(id: number, assigneeUserId: number, rowVersion: string) { return this.api.post<PricingRequest>(`/PricingRequests/Assign/${id}`, { assigneeUserId, rowVersion }); }
  cancel(id: number, note: string, rowVersion: string) { return this.api.post<PricingRequest>(`/PricingRequests/Cancel/${id}`, { note: note.trim() || null, rowVersion }); }

  // ─────────── العروض والمقارنة ───────────
  addOffer(requestId: number, v: PricingOfferInput) { return this.api.post<PricingRequest>(`/PricingRequests/Offers/${requestId}`, v); }
  updateOffer(offerId: number, v: PricingOfferInput) { return this.api.put<PricingRequest>(`/PricingRequests/Offer/${offerId}`, v); }
  select(lineId: number, reason: string) { return this.api.post<PricingRequest>(`/PricingRequests/Select/${lineId}`, { reason: reason.trim() }); }
  unselect(lineId: number) { return this.api.post<PricingRequest>(`/PricingRequests/Unselect/${lineId}`, {}); }
  recommend(id: number, note: string, rowVersion: string) { return this.api.post<PricingRequest>(`/PricingRequests/Recommend/${id}`, { note: note.trim(), rowVersion }); }
  decide(id: number, decision: number, note: string, rowVersion: string) { return this.api.post<PricingRequest>(`/PricingRequests/Decide/${id}`, { decision, note: note.trim() || null, rowVersion }); }
  sendResult(id: number, recipient: string, note: string, rowVersion: string) {
    return this.api.post<PricingRequest>(`/PricingRequests/SendResult/${id}`, { recipient: recipient.trim(), note: note.trim() || null, rowVersion });
  }

  // ─────────── محاضر الاتفاق ───────────
  searchAgreements(f: AgreementFilter) {
    const q = new URLSearchParams();
    if (f.branchId) q.set('branchId', String(f.branchId));
    if (f.status) q.set('status', String(f.status));
    if (f.supplierId) q.set('supplierId', String(f.supplierId));
    if (f.search.trim()) q.set('search', f.search.trim());
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<AgreementListItem>>(`/PricingAgreements/Search?${q}`);
  }
  getAgreement(id: number) { return this.api.get<Agreement>(`/PricingAgreements/Get/${id}`); }
  createAgreement(v: AgreementInput) { return this.api.post<Agreement>('/PricingAgreements/Create', v); }
  updateAgreement(id: number, v: AgreementInput) { return this.api.put<Agreement>(`/PricingAgreements/Update/${id}`, v); }
  submitAgreement(id: number, rowVersion: string) { return this.api.post<Agreement>(`/PricingAgreements/Submit/${id}`, { note: null, rowVersion }); }
  reviewAgreement(id: number, approve: boolean, note: string, rowVersion: string) { return this.api.post<Agreement>(`/PricingAgreements/Review/${id}`, { approve, note: note.trim() || null, rowVersion }); }
  cancelAgreement(id: number, note: string, rowVersion: string) { return this.api.post<Agreement>(`/PricingAgreements/Cancel/${id}`, { note: note.trim() || null, rowVersion }); }
}
