import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { query } from '../utils/query';
import {
  ArchitecturalVersionInput, BasisOption, DesignApproval, DesignApprovalInput, DrawingKind, StudyDrawing, StudyDrawingInput, StudyDrawingReviewInput
} from './studies.models';

/**
 * مخططات المشروع: المعماري له نسخ (Draft-N) ولكل نسخة اعتماد مخططات أولي واحد (CDA) بثلاثة موقّعين؛
 * بقية الأنواع تُبنى على نسخة معمارية معتمدة وتُراجع بـ Review. القسم المصدر وحده يعدّل مخططاته.
 */
@Injectable({ providedIn: 'root' })
export class StudyDrawingsService {
  private api = inject(ApiService);

  byProject(projectId: number, kind?: DrawingKind | null) {
    return this.api.get<StudyDrawing[]>(`/StudyDrawings/ByProject/${projectId}` + query({ kind }));
  }
  get(id: number) { return this.api.get<StudyDrawing>(`/StudyDrawings/Get/${id}`); }
  /** النسخ المعمارية المعتمدة في المشروع (الأساس الذي تُبنى عليه بقية المخططات): قائمة المعماري ثم تفاصيل كل مخطط لنسخه */
  approvedBasis(projectId: number): Observable<BasisOption[]> {
    return this.byProject(projectId, 1).pipe(
      switchMap(list => list.length ? forkJoin(list.map(d => this.get(d.id))) : of([] as StudyDrawing[])),
      map(drawings => drawings.flatMap(d => d.versions.filter(v => v.status === 3).map(v => ({ id: v.id, label: `${d.name} — ${v.label}` }))))
    );
  }
  create(body: StudyDrawingInput) { return this.api.post<StudyDrawing>('/StudyDrawings/Create', body); }
  update(id: number, body: StudyDrawingInput) { return this.api.put<StudyDrawing>(`/StudyDrawings/Update/${id}`, body); }
  remove(id: number) { return this.api.delete<{ message: string }>(`/StudyDrawings/Delete/${id}`); }
  review(id: number, body: StudyDrawingReviewInput) {
    return this.api.put<StudyDrawing>(`/StudyDrawings/Review/${id}`, { approve: body.approve, note: body.note?.trim() || null });
  }

  // ─────────── نسخ المعماري (تعيد المخطط كاملاً بنسخه) ───────────
  createVersion(drawingId: number, body: ArchitecturalVersionInput) {
    return this.api.post<StudyDrawing>(`/StudyDrawings/Versions/${drawingId}`, body);
  }
  updateVersion(id: number, body: ArchitecturalVersionInput) { return this.api.put<StudyDrawing>(`/StudyDrawings/Version/${id}`, body); }
  removeVersion(id: number) { return this.api.delete<StudyDrawing>(`/StudyDrawings/Version/${id}`); }

  // ─────────── اعتماد المخططات الأولي (CDA) ───────────
  designApproval(id: number) { return this.api.get<DesignApproval>(`/StudyDesignApprovals/Get/${id}`); }
  createDesignApproval(body: DesignApprovalInput) { return this.api.post<DesignApproval>('/StudyDesignApprovals/Create', body); }
  updateDesignApproval(id: number, body: DesignApprovalInput) {
    return this.api.put<DesignApproval>(`/StudyDesignApprovals/Update/${id}`, body);
  }
  removeDesignApproval(id: number) { return this.api.delete<{ message: string }>(`/StudyDesignApprovals/Delete/${id}`); }
}
