import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { STUDY_PRINT_ROUTES, StudyPrint, StudyPrintSegment } from './studies.models';

/** بيانات النماذج الورقية (PrintStudyDocuments + عرض المستند نفسه، وحدّها فرع الدراسة) */
@Injectable({ providedIn: 'root' })
export class StudyPrintService {
  private api = inject(ApiService);
  get(segment: StudyPrintSegment, id: number) { return this.api.get<StudyPrint>(`/StudyPrint/${STUDY_PRINT_ROUTES[segment]}/${id}`); }
}
