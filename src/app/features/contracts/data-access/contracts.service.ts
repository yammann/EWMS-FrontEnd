import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import {
  AppPermission, AppPermissionName, CONTRACT_ACCESS, CONTRACTOR_VIEW, CRITERION_VIEW, MANAGE_CONTRACTORS, MANAGE_CRITERIA
} from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  AmendmentInput, CommitteeInput, Contract, ContractAccess, ContractFilter, ContractInput, ContractItem, Contractor, ContractorInput,
  EvaluationCriterion, EvaluationCriterionInput, EvaluationHistoryItem, EvaluationInput, OfferInput, RetentionDecisionInput, RetentionInput
} from './contracts.models';

/** العقود والمقاولون ومعايير التقييم (api/Contracts و api/Contractors و api/EvaluationCriteria) — الحدود يطبّقها الخادم، ويعيد العقد كاملاً بأعلام الأزرار بعد كل عملية */
@Injectable({ providedIn: 'root' })
export class ContractsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يحسب ما يحق لي على كل عقد (canEdit، canAddAmendment…) */
  access = computed<ContractAccess>(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canView: this.auth.hasAnyPermission(CONTRACT_ACCESS),
      canCreate: has(AppPermission.CreateContract),
      canEdit: has(AppPermission.EditContract),
      canViewContractors: this.auth.hasAnyPermission(CONTRACTOR_VIEW),
      canManageContractors: this.auth.hasAnyPermission(MANAGE_CONTRACTORS),
      canCreateContractor: has(AppPermission.CreateContractor),
      canEditContractor: has(AppPermission.EditContractor),
      canDeleteContractor: has(AppPermission.DeleteContractor),
      canViewEvaluations: has(AppPermission.ViewContractorEvaluations),
      canViewCriteria: this.auth.hasAnyPermission(CRITERION_VIEW),
      canManageCriteria: this.auth.hasAnyPermission(MANAGE_CRITERIA),
      canCreateCriterion: has(AppPermission.CreateEvaluationCriterion),
      canEditCriterion: has(AppPermission.EditEvaluationCriterion),
      canDeleteCriterion: has(AppPermission.DeleteEvaluationCriterion),
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard)
    };
  });

  // ─────────── المقاولون ───────────
  contractors(branchId: number | null = null, includeInactive = false) {
    const q = new URLSearchParams();
    if (branchId) q.set('branchId', String(branchId));
    if (includeInactive) q.set('includeInactive', 'true');
    return this.api.get<Contractor[]>(`/Contractors/GetAll?${q}`);
  }
  createContractor(v: ContractorInput) { return this.api.post<Contractor>('/Contractors/Create', v); }
  updateContractor(id: number, v: ContractorInput) { return this.api.put<Contractor>(`/Contractors/Update/${id}`, v); }
  deleteContractor(id: number) { return this.api.delete<boolean>(`/Contractors/Delete/${id}`); }
  contractorEvaluations(id: number) { return this.api.get<EvaluationHistoryItem[]>(`/Contractors/Evaluations/${id}`); }

  // ─────────── معايير التقييم ───────────
  criteria(branchId: number | null = null, includeInactive = false) {
    const q = new URLSearchParams();
    if (branchId) q.set('branchId', String(branchId));
    if (includeInactive) q.set('includeInactive', 'true');
    return this.api.get<EvaluationCriterion[]>(`/EvaluationCriteria/GetAll?${q}`);
  }
  createCriterion(v: EvaluationCriterionInput) { return this.api.post<EvaluationCriterion>('/EvaluationCriteria/Create', v); }
  updateCriterion(id: number, v: EvaluationCriterionInput) { return this.api.put<EvaluationCriterion>(`/EvaluationCriteria/Update/${id}`, v); }
  deleteCriterion(id: number) { return this.api.delete<boolean>(`/EvaluationCriteria/Delete/${id}`); }

  // ─────────── العقود ───────────
  search(f: ContractFilter) {
    const q = new URLSearchParams();
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.status) q.set('status', String(f.status));
    if (f.method) q.set('method', String(f.method));
    if (f.contractorId) q.set('contractorId', String(f.contractorId));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.warrantyEndingOnly) q.set('warrantyEndingOnly', 'true');
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<ContractItem>>(`/Contracts/Search?${q}`);
  }
  get(id: number) { return this.api.get<Contract>(`/Contracts/Get/${id}`); }
  create(v: ContractInput) { return this.api.post<Contract>('/Contracts/Create', v); }
  update(id: number, v: ContractInput) { return this.api.put<Contract>(`/Contracts/Update/${id}`, v); }
  changeStatus(id: number, status: number, reason: string, rowVersion: string) {
    return this.api.post<Contract>(`/Contracts/Status/${id}`, { status, reason: reason.trim() || null, rowVersion });
  }

  // ─────────── العروض والإرساء ───────────
  addOffer(contractId: number, v: OfferInput) { return this.api.post<Contract>(`/Contracts/Offers/${contractId}`, v); }
  award(offerId: number, awardedAt: string | null, note: string, rowVersion: string) {
    return this.api.post<Contract>(`/Contracts/Award/${offerId}`, { awardedAt, note: note.trim() || null, rowVersion });
  }

  // ─────────── السجلات ───────────
  addAmendment(contractId: number, v: AmendmentInput) { return this.api.post<Contract>(`/Contracts/Amendments/${contractId}`, v); }
  createCommittee(contractId: number, v: CommitteeInput) { return this.api.post<Contract>(`/Contracts/Committees/${contractId}`, v); }
  updateCommittee(committeeId: number, v: CommitteeInput) { return this.api.put<Contract>(`/Contracts/Committee/${committeeId}`, v); }
  addRetention(contractId: number, v: RetentionInput) { return this.api.post<Contract>(`/Contracts/Retention/${contractId}`, v); }
  decideRetention(entryId: number, v: RetentionDecisionInput) { return this.api.post<Contract>(`/Contracts/RetentionDecision/${entryId}`, v); }

  // ─────────── تقييم المقاول ───────────
  createEvaluation(contractId: number, v: EvaluationInput) { return this.api.post<Contract>(`/Contracts/Evaluations/${contractId}`, v); }
  updateEvaluation(id: number, v: EvaluationInput) { return this.api.put<Contract>(`/Contracts/Evaluation/${id}`, v); }
  deleteEvaluation(id: number) { return this.api.delete<Contract>(`/Contracts/Evaluation/${id}`); }
  submitEvaluation(id: number, rowVersion: string) { return this.api.post<Contract>(`/Contracts/Evaluation/${id}/Submit`, { note: null, rowVersion }); }
  reviewEvaluation(id: number, note: string, rowVersion: string) { return this.api.post<Contract>(`/Contracts/Evaluation/${id}/Review`, { note: note.trim() || null, rowVersion }); }
  returnEvaluation(id: number, note: string, rowVersion: string) { return this.api.post<Contract>(`/Contracts/Evaluation/${id}/Return`, { note: note.trim(), rowVersion }); }
}
