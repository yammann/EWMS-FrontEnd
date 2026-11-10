/** فرع الدراسات المركزية — الطباعة (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyAssignment, StudyRequest, StudyResponse, StudyStartOrder } from './documents.models';
import { DesignApproval } from './drawings.models';
import { StudyDecision } from './enums.models';

/** توقيع في النموذج المطبوع: image = نسخة التوقيع المحفوظة وقت القرار (Data URL)، وnull = مربع فارغ */
export interface StudyPrintSignature {
  signerRole: number; signerRoleName: string; decision: StudyDecision; decisionName: string;
  signerName: string | null; jobTitle: string | null; decidedAt: string | null; decidedAtHijri: string | null;
  note: string | null; image: string | null;
}

/** نموذج ورقي: ترويسة (الرقم وفرع الدراسة والتاريخان) + المستند كاملاً (واحد فقط مملوء) + التواقيع */
export interface StudyPrint {
  documentType: string; title: string; number: string; branchName: string;
  documentDate: string; documentDateHijri: string;
  /** CDA فقط: رقم أمر بدء المشروع */
  startOrderNumber: string | null;
  request: StudyRequest | null; assignment: StudyAssignment | null; response: StudyResponse | null;
  startOrder: StudyStartOrder | null; designApproval: DesignApproval | null;
  signatures: StudyPrintSignature[];
}
/** أنواع النماذج المطبوعة: جزء الرابط (/studies/print/:segment/:id) ← مسار الـ API */
export const STUDY_PRINT_ROUTES = {
  requests: 'Request', assignments: 'Assignment', responses: 'Response', 'start-orders': 'StartOrder', 'design-approvals': 'DesignApproval'
} as const;
export type StudyPrintSegment = keyof typeof STUDY_PRINT_ROUTES;
