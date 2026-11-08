import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { query } from '../utils/query';
import { StudyEmployee, StudyLookup, StudyLookupInput, StudySiteOption, StudyStageType, StudyStageTypeInput } from './studies.models';

/** قوائم الدراسات البسيطة (اسم + فعّال) */
export type StudySimpleLookupKind = 'attachmentTypes' | 'disciplines';
const SIMPLE_ROUTES: Record<StudySimpleLookupKind, string> = {
  attachmentTypes: '/StudyLookups/AttachmentTypes', disciplines: '/StudyLookups/Disciplines'
};

/**
 * قوائم فرع الدراسات: أنواع المراحل (تُنسخ إلى كل مشروع جديد بترتيبها ووزنها)، أنواع المرفقات، والاختصاصات الهندسية.
 * القراءة: أنواع المراحل والاختصاصات بـ ViewStudyLookups، وأنواع المرفقات لمن يرى أي مستند (AnyStudyView).
 * المعطّل يبقى في السجلات القديمة ولا يظهر في النماذج الجديدة (activeOnly).
 */
@Injectable({ providedIn: 'root' })
export class StudyLookupsService {
  private api = inject(ApiService);

  stageTypes(activeOnly = false): Observable<StudyStageType[]> {
    return this.api.get<StudyStageType[]>('/StudyLookups/StageTypes/GetAll' + query({ activeOnly: activeOnly || null }));
  }
  createStageType(body: StudyStageTypeInput) { return this.api.post<StudyStageType>('/StudyLookups/StageTypes/Create', body); }
  updateStageType(id: number, body: StudyStageTypeInput) { return this.api.put<StudyStageType>(`/StudyLookups/StageTypes/Update/${id}`, body); }
  deleteStageType(id: number) { return this.api.delete<{ message: string }>(`/StudyLookups/StageTypes/Delete/${id}`); }

  /**
   * موظفو فرع الدراسة النشطون لقوائم الاختيار (مدير المشروع، المهندسون، أعضاء القسم المشارك مع departmentId).
   * الحد فرع المستخدم؛ من يتصفح المؤسسة يمرّر branchId (فرع الدراسة) أو departmentId — ما فيها هو ما يقبله الخادم.
   */
  employees(filter: { branchId?: number | null; departmentId?: number | null } = {}): Observable<StudyEmployee[]> {
    return this.api.get<StudyEmployee[]>('/StudyLookups/Employees' + query(filter));
  }

  /**
   * مواقع السجل المشترك لربط الطلب بموقع (فيظهر مشروعه على خريطة الفرع). تحتاج صلاحية عرض المواقع (AnySiteView)،
   * ومن لا يملكها لا يرى الحقل ولا يمنعه ذلك من حفظ الطلب.
   */
  sites(): Observable<StudySiteOption[]> { return this.api.get<StudySiteOption[]>('/Sites/GetAll'); }

  lookup(kind: StudySimpleLookupKind, activeOnly = false): Observable<StudyLookup[]> {
    return this.api.get<StudyLookup[]>(`${SIMPLE_ROUTES[kind]}/GetAll` + query({ activeOnly: activeOnly || null }));
  }
  createLookup(kind: StudySimpleLookupKind, body: StudyLookupInput) { return this.api.post<StudyLookup>(`${SIMPLE_ROUTES[kind]}/Create`, body); }
  updateLookup(kind: StudySimpleLookupKind, id: number, body: StudyLookupInput) {
    return this.api.put<StudyLookup>(`${SIMPLE_ROUTES[kind]}/Update/${id}`, body);
  }
  deleteLookup(kind: StudySimpleLookupKind, id: number) { return this.api.delete<{ message: string }>(`${SIMPLE_ROUTES[kind]}/Delete/${id}`); }
}
