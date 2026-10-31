import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, HANDOVER_ACCESS } from '@core/constants/access';
import { PagedResult } from '@core/models/paged-result.model';
import { ClosureWarnings, ConcludeInput, Handover, HandoverAccess, HandoverCommitteeInput, HandoverFilter, HandoverInput, HandoverItem, NoteInput } from './handover.models';

/** الاستلام والتسليم (api/Handovers) — الحدود يطبّقها الخادم، ويعيد المحضر كاملاً بأعلام الأزرار بعد كل عملية */
@Injectable({ providedIn: 'root' })
export class HandoverService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  access = computed<HandoverAccess>(() => ({
    canView: this.auth.hasAnyPermission(HANDOVER_ACCESS),
    canRequest: this.auth.hasPermission(AppPermission.RequestHandover),
    canManage: this.auth.hasPermission(AppPermission.ManageHandover),
    canFollowNotes: this.auth.hasPermission(AppPermission.FollowHandoverNotes)
  }));

  search(f: HandoverFilter) {
    const q = new URLSearchParams();
    if (f.projectId) q.set('projectId', String(f.projectId));
    if (f.kind) q.set('kind', String(f.kind));
    if (f.status) q.set('status', String(f.status));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.openNotesOnly) q.set('openNotesOnly', 'true');
    q.set('page', String(f.page)); q.set('pageSize', String(f.pageSize));
    return this.api.get<PagedResult<HandoverItem>>(`/Handovers/Search?${q}`);
  }
  get(id: number) { return this.api.get<Handover>(`/Handovers/Get/${id}`); }
  closureWarnings(projectId: number) { return this.api.get<ClosureWarnings>(`/Handovers/ClosureWarnings/${projectId}`); }
  request(v: HandoverInput) { return this.api.post<Handover>('/Handovers/Request', v); }
  cancel(id: number, reason: string, rowVersion: string) { return this.api.post<Handover>(`/Handovers/Cancel/${id}`, { reason: reason.trim() || null, rowVersion }); }

  formCommittee(id: number, v: HandoverCommitteeInput) { return this.api.post<Handover>(`/Handovers/Committee/${id}`, v); }
  updateCommittee(id: number, v: HandoverCommitteeInput) { return this.api.put<Handover>(`/Handovers/Committee/${id}`, v); }
  conclude(id: number, v: ConcludeInput) { return this.api.post<Handover>(`/Handovers/Conclude/${id}`, v); }

  addNote(id: number, v: NoteInput) { return this.api.post<Handover>(`/Handovers/Notes/${id}`, v); }
  updateNote(noteId: number, v: NoteInput) { return this.api.put<Handover>(`/Handovers/Note/${noteId}`, v); }
  removeNote(noteId: number) { return this.api.delete<Handover>(`/Handovers/Note/${noteId}`); }
  fix(noteId: number, fixNote: string, rowVersion: string) { return this.api.post<Handover>(`/Handovers/Note/${noteId}/Fix`, { fixNote: fixNote.trim(), evidenceVersionId: null, rowVersion }); }
  verify(noteId: number, note: string, rowVersion: string) { return this.api.post<Handover>(`/Handovers/Note/${noteId}/Verify`, { note: note.trim() || null, evidenceVersionId: null, rowVersion }); }
  reject(noteId: number, note: string, rowVersion: string) { return this.api.post<Handover>(`/Handovers/Note/${noteId}/Reject`, { note: note.trim(), evidenceVersionId: null, rowVersion }); }
}
