import { Injectable, computed, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName, MANAGE_DIWAN_LOOKUPS } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  CorrespondenceFilter, Correspondence, CorrespondenceItem, CorrespondenceStatus, CorrespondenceStatusInput, CorrespondenceType, CorrespondenceTypeInput,
  CreateDraftInput, HistoryEntry, ProjectOption, CorrespondencePrint, ReferInput, ReferralDepartment, ReferralUser, RegisterIncomingInput, UpdateCorrespondenceInput
} from './diwan.models';

/** الديوان: المعاملات الواردة والصادرة وإعدادات الفرع (api/Correspondence و api/CorrespondenceTypes و api/CorrespondenceStatuses) — الحدود يطبّقها الخادم */
@Injectable({ providedIn: 'root' })
export class DiwanService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يرفض ما يخرج عن حدّ المعاملة ويحسب ما يحق لي على كل معاملة (canRefer…) */
  access = computed(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canRegister: has(AppPermission.RegisterCorrespondence),
      canHandle: has(AppPermission.HandleCorrespondence),
      canViewReport: has(AppPermission.ExportCorrespondenceReport) || has(AppPermission.ExportOverdueCorrespondenceReport),
      canManageLookups: this.auth.hasAnyPermission(MANAGE_DIWAN_LOOKUPS),
      canCreateLookup: has(AppPermission.CreateCorrespondenceLookup),
      canEditLookup: has(AppPermission.EditCorrespondenceLookup),
      canDeleteLookup: has(AppPermission.DeleteCorrespondenceLookup),
      /** يختار الفرع (نظرة المؤسسة) */
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard),
      /** المشاريع في نماذج التسجيل */
      canListProjects: this.auth.hasAnyPermission([AppPermission.ViewProjects, AppPermission.ViewDepartmentProjects, AppPermission.ViewBranchProjects, AppPermission.CreateProject, AppPermission.EditProject])
    };
  });

  // ─────────── الأنواع والحالات ───────────
  types(branchId: number | null = null, includeInactive = false) {
    return this.api.get<CorrespondenceType[]>(`/CorrespondenceTypes/GetAll?${this.lookupQuery(branchId, includeInactive)}`);
  }
  createType(v: CorrespondenceTypeInput) { return this.api.post<CorrespondenceType>('/CorrespondenceTypes/Create', v); }
  updateType(id: number, v: CorrespondenceTypeInput) { return this.api.put<CorrespondenceType>(`/CorrespondenceTypes/Update/${id}`, v); }
  deleteType(id: number) { return this.api.delete<{ message: string }>(`/CorrespondenceTypes/Delete/${id}`); }

  statuses(branchId: number | null = null, includeInactive = false) {
    return this.api.get<CorrespondenceStatus[]>(`/CorrespondenceStatuses/GetAll?${this.lookupQuery(branchId, includeInactive)}`);
  }
  createStatus(v: CorrespondenceStatusInput) { return this.api.post<CorrespondenceStatus>('/CorrespondenceStatuses/Create', v); }
  updateStatus(id: number, v: CorrespondenceStatusInput) { return this.api.put<CorrespondenceStatus>(`/CorrespondenceStatuses/Update/${id}`, v); }
  deleteStatus(id: number) { return this.api.delete<{ message: string }>(`/CorrespondenceStatuses/Delete/${id}`); }

  private lookupQuery(branchId: number | null, includeInactive: boolean) {
    const q = new URLSearchParams();
    if (branchId) q.set('branchId', String(branchId));
    if (includeInactive) q.set('includeInactive', 'true');
    return q;
  }

  /** مشاريع أراها (حتى 100، ببحث اختياري) لخيار «المشروع» في النماذج */
  projects(search = '') {
    const q = new URLSearchParams({ page: '1', pageSize: '100' });
    if (search.trim()) q.set('search', search.trim());
    return this.api.get<PagedResult<ProjectOption>>(`/Projects/Search?${q}`).pipe(map(r => r.items));
  }

  // ─────────── المعاملات ───────────
  search(f: CorrespondenceFilter) {
    const q = new URLSearchParams();
    if (f.direction) q.set('direction', String(f.direction));
    if (f.typeId) q.set('typeId', String(f.typeId));
    if (f.statusId) q.set('statusId', String(f.statusId));
    if (f.stage) q.set('stage', String(f.stage));
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.from) q.set('from', f.from);
    if (f.to) q.set('to', f.to);
    if (f.overdueOnly) q.set('overdueOnly', 'true');
    if (f.inbox) q.set('inbox', 'true');
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<CorrespondenceItem>>(`/Correspondence/Search?${q}`);
  }
  get(id: number) { return this.api.get<Correspondence>(`/Correspondence/Get/${id}`); }
  history(id: number) { return this.api.get<HistoryEntry[]>(`/Correspondence/History/${id}`); }
  printData(id: number) { return this.api.get<CorrespondencePrint>(`/Correspondence/Print/${id}`); }

  registerIncoming(v: RegisterIncomingInput) { return this.api.post<Correspondence>('/Correspondence/RegisterIncoming', v); }
  createDraft(v: CreateDraftInput) { return this.api.post<Correspondence>('/Correspondence/CreateDraft', v); }
  update(id: number, v: UpdateCorrespondenceInput) { return this.api.put<Correspondence>(`/Correspondence/Update/${id}`, v); }

  // ─────────── الإحالة والحالة ───────────
  referralTargets(branchId: number | null = null) {
    return this.api.get<ReferralDepartment[]>(`/Correspondence/ReferralTargets${branchId ? `?branchId=${branchId}` : ''}`);
  }
  referralUsers(departmentId: number, officeId: number | null) {
    return this.api.get<ReferralUser[]>(`/Correspondence/ReferralUsers?departmentId=${departmentId}${officeId ? `&officeId=${officeId}` : ''}`);
  }
  refer(id: number, v: ReferInput) { return this.api.post<Correspondence>(`/Correspondence/Refer/${id}`, v); }
  acknowledge(id: number) { return this.api.post<Correspondence>(`/Correspondence/Acknowledge/${id}`, {}); }
  setStatus(id: number, statusId: number, rowVersion: string) { return this.api.put<Correspondence>(`/Correspondence/Status/${id}`, { statusId, rowVersion }); }

  // ─────────── الصادر ───────────
  submit(id: number) { return this.api.post<Correspondence>(`/Correspondence/Submit/${id}`, {}); }
  decide(id: number, approve: boolean, note: string, rowVersion: string) {
    return this.api.post<Correspondence>(`/Correspondence/Decide/${id}`, { approve, note: note.trim() || null, rowVersion });
  }
  issue(id: number) { return this.api.post<Correspondence>(`/Correspondence/Issue/${id}`, {}); }

  // ─────────── المرفقات ───────────
  attach(id: number, files: File[]) {
    const body = new FormData();
    for (const file of files) body.append('files', file, file.name);
    return this.api.post<Correspondence>(`/Correspondence/Attachments/${id}`, body);
  }
  attachmentBlob(attachmentId: number, download = false) { return this.api.getBlob(`/Correspondence/Attachment/${attachmentId}${download ? '?download=true' : ''}`); }
  deleteAttachment(attachmentId: number) { return this.api.delete<Correspondence>(`/Correspondence/Attachment/${attachmentId}`); }
}
