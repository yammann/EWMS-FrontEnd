import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResult } from '@core/models/paged-result.model';
import { allPages } from '../utils/all-pages';
import { query } from '../utils/query';
import {
  STUDY_DOCUMENT_ROUTES, StudyActivityLog, StudyChain, StudyDocumentFilter, StudyDocumentKind, StudyDocumentKinds, StudyResponse, StudyResponsePlanningInput
} from './studies.models';

type Item<K extends StudyDocumentKind> = StudyDocumentKinds[K]['item'];
type Input<K extends StudyDocumentKind> = StudyDocumentKinds[K]['input'];

/**
 * مستندات الدراسة الأربعة (الطلب، التكليف، الرد، أمر البدء) بواجهة واحدة: نفس المسارات لكل نوع.
 * الإنشاء يحمل رقم المستند السابق المعتمد، والحذف للمسودة فقط، والمعتمد يُلغى بسبب (يبقى للأرشيف).
 * Submit يرسل للتوقيع بالترتيب (الطلب يُعتمد فوراً لأنه بلا موقّعين).
 */
@Injectable({ providedIn: 'root' })
export class StudyDocumentsService {
  private api = inject(ApiService);

  private base(kind: StudyDocumentKind) { return '/' + STUDY_DOCUMENT_ROUTES[kind]; }

  list<K extends StudyDocumentKind>(kind: K, filter: StudyDocumentFilter = {}): Observable<PagedResult<Item<K>>> {
    return this.api.get<PagedResult<Item<K>>>(`${this.base(kind)}/GetAll` + query(filter));
  }
  get<K extends StudyDocumentKind>(kind: K, id: number): Observable<Item<K>> {
    return this.api.get<Item<K>>(`${this.base(kind)}/Get/${id}`);
  }
  create<K extends StudyDocumentKind>(kind: K, body: Input<K>): Observable<Item<K>> {
    return this.api.post<Item<K>>(`${this.base(kind)}/Create`, body);
  }
  update<K extends StudyDocumentKind>(kind: K, id: number, body: Input<K>): Observable<Item<K>> {
    return this.api.put<Item<K>>(`${this.base(kind)}/Update/${id}`, body);
  }
  remove(kind: StudyDocumentKind, id: number) {
    return this.api.delete<{ message: string }>(`${this.base(kind)}/Delete/${id}`);
  }
  submit<K extends StudyDocumentKind>(kind: K, id: number): Observable<Item<K>> {
    return this.api.put<Item<K>>(`${this.base(kind)}/Submit/${id}`, {});
  }
  cancel<K extends StudyDocumentKind>(kind: K, id: number, reason: string): Observable<Item<K>> {
    return this.api.put<Item<K>>(`${this.base(kind)}/Cancel/${id}`, { reason: reason.trim() });
  }

  /** جزء التخطيط وإدارة المشاريع من الرد: يحفظه من يملك EditStudyResponsePlanning بعد توقيع القسم المتابع وقبل توقيع التخطيط */
  updateResponsePlanning(id: number, body: StudyResponsePlanningInput): Observable<StudyResponse> {
    return this.api.put<StudyResponse>(`/StudyResponses/UpdatePlanning/${id}`, body);
  }

  /**
   * رقم الرد RSP لسلسلة: بيانات السلسلة من الخادم لا تحمله فيُجلب من الرد نفسه.
   * من لا يملك عرض الردود (أو لا رد بعد) يحصل على null فتعرض الواجهة اسم الخطوة.
   */
  responseNumberOf(chain: StudyChain | null | undefined): Observable<string | null> {
    if (!chain?.responseId) return of(null);
    return this.get('responses', chain.responseId).pipe(map(r => r.responseNumber || null), catchError(() => of(null)));
  }

  /** سجل الدراسة كلها (من الطلب حتى المشروع)، الأحدث أولاً. مُرقَّم في الخادم (100 للصفحة) فتُجمع صفحاته */
  activityLog(requestId: number) {
    return allPages(page => this.api.get<PagedResult<StudyActivityLog>>(`/StudyActivityLogs/ByRequest/${requestId}?page=${page}&pageSize=100`));
  }
}
