import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { StudyApproval, StudyApprovalQueueItem, StudyDecisionInput } from './studies.models';

/**
 * تواقيع مستندات الدراسة: تُوقَّع بالترتيب، وكل سطر لصفة موقّع (صلاحية SignStudyAs…).
 * «معتمد مع ملاحظات» والرفض يحتاجان ملاحظة، وأي رفض يرفض المستند كله.
 */
@Injectable({ providedIn: 'root' })
export class StudyApprovalsService {
  private api = inject(ApiService);

  /** ما أستطيع التوقيع عليه الآن (صفتي وحدّها ودوري في الترتيب) */
  pending() { return this.api.get<StudyApprovalQueueItem[]>('/StudyApprovals/Pending'); }
  decide(approvalId: number, body: StudyDecisionInput) {
    return this.api.put<StudyApproval>(`/StudyApprovals/Decide/${approvalId}`, { decision: body.decision, note: body.note?.trim() || null });
  }
}
