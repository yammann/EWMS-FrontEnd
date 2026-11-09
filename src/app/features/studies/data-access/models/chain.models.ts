/** فرع الدراسات المركزية — السلسلة والتواقيع (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyDecision, StudyDocumentStatus, StudyOwnerType, StudyProjectStatus } from './enums.models';

/** سلسلة الدراسة من الطلب إلى المشروع (في التفاصيل فقط) */
export interface StudyChain {
  requestId: number; requestNumber: string; requestStatus: StudyDocumentStatus;
  assignmentId: number | null; assignmentNumber: string | null; assignmentStatus: StudyDocumentStatus | null;
  responseId: number | null; responseStatus: StudyDocumentStatus | null;
  startOrderId: number | null; startOrderNumber: string | null; startOrderStatus: StudyDocumentStatus | null;
  projectId: number | null; projectCode: string | null; projectStatus: StudyProjectStatus | null;
}

/** سطر توقيع؛ canDecide = يستطيع المستخدم التوقيع عليه الآن (الصفة والحد والترتيب) */
export interface StudyApproval {
  id: number; signerRole: number; signerRoleName: string; sortOrder: number;
  decision: StudyDecision; decisionName: string;
  signerUserId: number | null; signerName: string | null; jobTitle: string | null; hasSignature: boolean;
  decidedAt: string | null; note: string | null; canDecide: boolean;
}

/** سطر في «بانتظار توقيعي» */
export interface StudyApprovalQueueItem {
  approvalId: number; ownerType: StudyOwnerType; ownerTypeName: string; ownerId: number;
  ownerNumber: string; ownerTitle: string; signerRole: number; signerRoleName: string; sortOrder: number;
  branchId: number; branchName: string;
}

export interface StudyDecisionInput { decision: StudyDecision; note?: string | null; }
