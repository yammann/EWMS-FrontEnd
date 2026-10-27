import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import {
  AuditEntry, DocumentFilter, DocumentVersion, MemberCandidate, Project, ProjectDocument, ProjectFilter, ProjectInput, UploadSession, StartUploadInput
} from './projects.models';

/** المشاريع ووثائقها (api/Projects و api/ProjectDocuments و api/ProjectUploads) — الحدود يطبّقها الخادم */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يرفض ما يخرج عن حدّ المشروع */
  access = computed(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canCreate: has(AppPermission.CreateProject),
      canEdit: has(AppPermission.EditProject),
      canViewDocuments: has(AppPermission.ViewProjectDocuments),
      canDownload: has(AppPermission.DownloadProjectDocument),
      canUpload: has(AppPermission.UploadProjectDocument),
      canApprove: has(AppPermission.ApproveProjectDocument),
      canDeleteDocument: has(AppPermission.DeleteProjectDocument),
      canViewAudit: has(AppPermission.ViewProjectAudit),
      /** يختار فرع المشروع (نظرة المؤسسة) */
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard),
      /** قوائم الأقسام والمواقع في النموذج */
      canListDepartments: has(AppPermission.ViewDepartments)
    };
  });

  // ─────────── المشاريع ───────────
  search(f: ProjectFilter) {
    const q = new URLSearchParams();
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.branchId) q.set('branchId', String(f.branchId));
    if (f.departmentId) q.set('departmentId', String(f.departmentId));
    if (f.siteId) q.set('siteId', String(f.siteId));
    if (f.stage) q.set('stage', String(f.stage));
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<Project>>(`/Projects/Search?${q}`);
  }
  get(id: number) { return this.api.get<Project>(`/Projects/Get/${id}`); }
  create(v: ProjectInput) { return this.api.post<Project>('/Projects/Create', v); }
  update(id: number, v: ProjectInput) { return this.api.put<Project>(`/Projects/Update/${id}`, v); }

  memberCandidates(id: number, search: string) {
    return this.api.get<MemberCandidate[]>(`/Projects/MemberCandidates/${id}?search=${encodeURIComponent(search.trim())}`);
  }
  addMember(id: number, userId: number, title: string) { return this.api.post<Project>(`/Projects/Members/${id}`, { userId, title }); }
  removeMember(id: number, userId: number) { return this.api.delete<Project>(`/Projects/Members/${id}/${userId}`); }

  audit(id: number, entityType: string, page: number, pageSize: number) {
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (entityType) q.set('entityType', entityType);
    return this.api.get<PagedResult<AuditEntry>>(`/Projects/Audit/${id}?${q}`);
  }

  // ─────────── الوثائق ───────────
  documents(f: DocumentFilter) {
    const q = new URLSearchParams();
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.kind) q.set('kind', String(f.kind));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.from) q.set('from', f.from);
    if (f.to) q.set('to', f.to);
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<ProjectDocument>>(`/ProjectDocuments/Search?${q}`);
  }
  document(id: number) { return this.api.get<ProjectDocument>(`/ProjectDocuments/Get/${id}`); }
  approve(versionId: number) { return this.api.post<ProjectDocument>(`/ProjectDocuments/Approve/${versionId}`, {}); }
  deleteDocument(id: number) { return this.api.delete<void>(`/ProjectDocuments/Delete/${id}`); }
  /** مسار ملف إصدار (يُجلب بترويسة الدخول عبر fetch، فلا يصلح رابطاً مباشراً) */
  versionFilePath(version: Pick<DocumentVersion, 'id'>, download: boolean) {
    return `/ProjectDocuments/Version/${version.id}/File${download ? '?download=true' : ''}`;
  }

  // ─────────── جلسات الرفع ───────────
  startUpload(v: StartUploadInput) { return this.api.post<UploadSession>('/ProjectUploads/Start', v); }
  upload(id: string) { return this.api.get<UploadSession>(`/ProjectUploads/${id}`); }
  myUploads(projectId: number | null) { return this.api.get<UploadSession[]>('/ProjectUploads/Mine' + (projectId ? `?projectId=${projectId}` : '')); }
  completeUpload(id: string) { return this.api.post<UploadSession>(`/ProjectUploads/${id}/Complete`, {}); }
  cancelUpload(id: string) { return this.api.delete<void>(`/ProjectUploads/${id}`); }
}
