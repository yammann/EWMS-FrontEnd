import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName, PRICING_ACCESS, PRICING_AGREEMENT_ACCESS, REFERENCE_PRICE_ACCESS, RECONCILIATION_ACCESS } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  Agreement, AgreementFilter, AgreementInput, AgreementListItem, PricingAccess, PricingAssignee, PricingFilter, PricingListItem, PricingOfferInput, PricingRequest, PricingRequestInput,
  Reconciliation, ReconciliationCandidate, ReconciliationFilter, ReconciliationInput, ReconciliationItem,
  ReferencePrice, ReferencePriceCorrection, ReferencePriceFilter, ReferencePriceImportReport, ReferencePriceInput, ReferencePriceItem
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
      canViewReferencePrices: this.auth.hasAnyPermission(REFERENCE_PRICE_ACCESS),
      canAddReferencePrice: has(AppPermission.AddReferencePrice),
      canApproveReferencePrice: has(AppPermission.ApproveReferencePrice),
      canImportReferencePrices: has(AppPermission.ImportReferencePrices),
      canViewReconciliations: this.auth.hasAnyPermission(RECONCILIATION_ACCESS),
      canPrepareReconciliation: has(AppPermission.PreparePriceReconciliation),
      canApproveReconciliation: has(AppPermission.ApprovePriceReconciliation),
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

  // ─────────── الأسعار المرجعية ───────────
  searchReferencePrices(f: ReferencePriceFilter) {
    const q = new URLSearchParams();
    if (f.branchId) q.set('branchId', String(f.branchId));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.supplierId) q.set('supplierId', String(f.supplierId));
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.status) q.set('status', String(f.status));
    if (f.includeSuperseded) q.set('includeSuperseded', 'true');
    if (f.from) q.set('from', f.from);
    if (f.to) q.set('to', f.to);
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<ReferencePriceItem>>(`/ReferencePrices/Search?${q}`);
  }
  getReferencePrice(id: number) { return this.api.get<ReferencePrice>(`/ReferencePrices/Get/${id}`); }
  createReferencePrice(v: ReferencePriceInput) { return this.api.post<ReferencePrice>('/ReferencePrices/Create', v); }
  correctReferencePrice(id: number, v: ReferencePriceCorrection) { return this.api.post<ReferencePrice>(`/ReferencePrices/Correct/${id}`, v); }
  referencePriceTemplate() { return this.api.getBlob('/ReferencePrices/ImportTemplate'); }
  /** dryRun=true معاينة بلا حفظ؛ false يحفظ كل الأسعار أو لا شيء (سطر خاطئ واحد يمنع الحفظ). branchId لنظرة المؤسسة */
  importReferencePrices(file: File, dryRun: boolean, branchId: number | null = null) {
    const body = new FormData();
    body.append('file', file);
    const q = new URLSearchParams({ dryRun: String(dryRun) });
    if (branchId) q.set('branchId', String(branchId));
    return this.api.post<ReferencePriceImportReport>(`/ReferencePrices/Import?${q}`, body);
  }
  approveReferencePrice(id: number, note: string, rowVersion: string) { return this.api.post<ReferencePrice>(`/ReferencePrices/Approve/${id}`, { note: note.trim() || null, rowVersion }); }

  // ─────────── مطابقة الفواتير والكشوف ───────────
  searchReconciliations(f: ReconciliationFilter) {
    const q = new URLSearchParams();
    if (f.branchId) q.set('branchId', String(f.branchId));
    if (f.status) q.set('status', String(f.status));
    if (f.supplierId) q.set('supplierId', String(f.supplierId));
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.search.trim()) q.set('search', f.search.trim());
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<ReconciliationItem>>(`/PriceReconciliations/Search?${q}`);
  }
  getReconciliation(id: number) { return this.api.get<Reconciliation>(`/PriceReconciliations/Get/${id}`); }
  /** مراجع مقترحة لمورد: أسطر عروض مختارة من طلبات معتمدة وأسعار مرجعية معتمدة */
  reconciliationCandidates(supplierId: number, search = '', branchId: number | null = null) {
    const q = new URLSearchParams({ supplierId: String(supplierId) });
    if (search.trim()) q.set('search', search.trim());
    if (branchId) q.set('branchId', String(branchId));
    return this.api.get<ReconciliationCandidate[]>(`/PriceReconciliations/Candidates?${q}`);
  }
  createReconciliation(v: ReconciliationInput) { return this.api.post<Reconciliation>('/PriceReconciliations/Create', v); }
  updateReconciliation(id: number, v: ReconciliationInput) { return this.api.put<Reconciliation>(`/PriceReconciliations/Update/${id}`, v); }
  recordReconciliation(id: number, result: number, note: string, rowVersion: string) { return this.api.post<Reconciliation>(`/PriceReconciliations/Record/${id}`, { result, note: note.trim() || null, rowVersion }); }
  decideReconciliation(id: number, approve: boolean, note: string, rowVersion: string) { return this.api.post<Reconciliation>(`/PriceReconciliations/Decide/${id}`, { approve, note: note.trim() || null, rowVersion }); }
  referReconciliation(id: number, recipient: string, note: string, rowVersion: string) { return this.api.post<Reconciliation>(`/PriceReconciliations/Refer/${id}`, { recipient: recipient.trim(), note: note.trim() || null, rowVersion }); }
  cancelReconciliation(id: number, note: string, rowVersion: string) { return this.api.post<Reconciliation>(`/PriceReconciliations/Cancel/${id}`, { note: note.trim() || null, rowVersion }); }
}
