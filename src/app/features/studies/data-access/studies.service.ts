import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName, MANAGE_DELIVERABLE_TYPES, STUDY_ACCESS } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  DeliverableInput, DeliverableType, DeliverableTypeInput, Study, StudyAccess, StudyFilter, StudyInput, StudyItem
} from './studies.models';

/** الدراسات والمكاتب الفنية (api/Studies و api/DeliverableTypes) — الحدود يطبّقها الخادم، ويعيد الأمر كاملاً بأعلام الأزرار بعد كل عملية */
@Injectable({ providedIn: 'root' })
export class StudiesService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يحسب ما يحق لي على كل أمر ومخرج (canPrepare، canReview…) */
  access = computed<StudyAccess>(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canView: this.auth.hasAnyPermission(STUDY_ACCESS),
      canCreate: has(AppPermission.CreateStudyOrder),
      canEdit: has(AppPermission.EditStudyOrder),
      canPrepare: has(AppPermission.PrepareStudyDeliverable),
      canReview: has(AppPermission.ReviewStudyDeliverable),
      canSend: has(AppPermission.RecordStudySubmission),
      canViewTypes: has(AppPermission.ViewDeliverableTypes),
      canManageTypes: this.auth.hasAnyPermission(MANAGE_DELIVERABLE_TYPES),
      canCreateType: has(AppPermission.CreateDeliverableType),
      canEditType: has(AppPermission.EditDeliverableType),
      canDeleteType: has(AppPermission.DeleteDeliverableType),
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard)
    };
  });

  // ─────────── أنواع المخرجات ───────────
  types(branchId: number | null = null, includeInactive = false) {
    const q = new URLSearchParams();
    if (branchId) q.set('branchId', String(branchId));
    if (includeInactive) q.set('includeInactive', 'true');
    return this.api.get<DeliverableType[]>(`/DeliverableTypes/GetAll?${q}`);
  }
  createType(v: DeliverableTypeInput) { return this.api.post<DeliverableType>('/DeliverableTypes/Create', v); }
  updateType(id: number, v: DeliverableTypeInput) { return this.api.put<DeliverableType>(`/DeliverableTypes/Update/${id}`, v); }
  deleteType(id: number) { return this.api.delete<boolean>(`/DeliverableTypes/Delete/${id}`); }

  // ─────────── الأوامر ───────────
  search(f: StudyFilter) {
    const q = new URLSearchParams();
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.status) q.set('status', String(f.status));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.overdueOnly) q.set('overdueOnly', 'true');
    if (f.mine) q.set('mine', 'true');
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<StudyItem>>(`/Studies/Search?${q}`);
  }
  get(id: number) { return this.api.get<Study>(`/Studies/Get/${id}`); }
  create(v: StudyInput) { return this.api.post<Study>('/Studies/Create', v); }
  update(id: number, v: StudyInput) { return this.api.put<Study>(`/Studies/Update/${id}`, v); }
  cancel(id: number, rowVersion: string) { return this.api.post<Study>(`/Studies/Cancel/${id}`, { rowVersion }); }
  reopen(id: number, rowVersion: string) { return this.api.post<Study>(`/Studies/Reopen/${id}`, { rowVersion }); }

  // ─────────── المخرجات ───────────
  addDeliverable(studyId: number, v: DeliverableInput) { return this.api.post<Study>(`/Studies/Deliverables/${studyId}`, v); }
  updateDeliverable(id: number, v: DeliverableInput) { return this.api.put<Study>(`/Studies/Deliverable/${id}`, v); }
  removeDeliverable(id: number) { return this.api.delete<Study>(`/Studies/Deliverable/${id}`); }
  attachDocument(id: number, documentId: number, rowVersion: string) { return this.api.put<Study>(`/Studies/Deliverable/${id}/Document`, { documentId, rowVersion }); }
  submitDeliverable(id: number, rowVersion: string) { return this.api.post<Study>(`/Studies/Deliverable/${id}/Submit`, { rowVersion }); }
  review(id: number, approve: boolean, note: string, rowVersion: string) {
    return this.api.post<Study>(`/Studies/Deliverable/${id}/Review`, { approve, note: note.trim() || null, rowVersion });
  }
  sendBack(id: number, note: string, rowVersion: string) { return this.api.post<Study>(`/Studies/Deliverable/${id}/SendBack`, { note: note.trim(), rowVersion }); }

  // ─────────── المركزية ───────────
  send(studyId: number, note: string, rowVersion: string) {
    return this.api.post<Study>(`/Studies/Send/${studyId}`, { note: note.trim() || null, outgoingCorrespondenceId: null, rowVersion });
  }
  decide(submissionId: number, decision: number, note: string, rowVersion: string) {
    return this.api.post<Study>(`/Studies/Decide/${submissionId}`, { decision, note: note.trim() || null, decisionVersionId: null, rowVersion });
  }
}
