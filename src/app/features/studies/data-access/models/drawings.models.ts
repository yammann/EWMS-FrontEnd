/** فرع الدراسات المركزية — المخططات واعتماد المخططات الأولي (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyApproval } from './chain.models';
import { DrawingKind, DrawingStatus, StudyDecision } from './enums.models';

export interface ArchitecturalVersion {
  id: number; drawingId: number; versionNumber: number; label: string; versionDate: string; content: string | null;
  status: DrawingStatus; statusName: string; createdByName: string; createdAt: string; rowVersion: string;
  designApprovalId: number | null; designApprovalNumber: string | null; designApprovalDecision: StudyDecision | null;
}
export interface ArchitecturalVersionInput { versionDate: string; content?: string | null; rowVersion?: string | null; }

export interface StudyDrawing {
  id: number; projectId: number; projectCode: string; kind: DrawingKind; kindName: string;
  name: string; drawingNumber: string; drawingDate: string; description: string | null;
  departmentId: number; departmentName: string; officeId: number | null; officeName: string | null;
  preparedByUserId: number; preparedByName: string;
  basedOnVersionId: number | null; basedOnVersionLabel: string | null;
  status: DrawingStatus; statusName: string; createdAt: string; updatedAt: string | null; rowVersion: string;
  canEdit: boolean; canReview: boolean;
  /** للمعماري فقط (في التفاصيل) */
  versions: ArchitecturalVersion[];
}
/** غير المعماري يُبنى على نسخة معمارية معتمدة (basedOnVersionId) */
export interface StudyDrawingInput {
  projectId: number; kind: DrawingKind; name: string; drawingNumber: string; drawingDate: string;
  description?: string | null; departmentId?: number | null; basedOnVersionId?: number | null;
  status?: DrawingStatus | null; rowVersion?: string | null;
}
/** نسخة معمارية معتمدة يُبنى عليها مخطط غير معماري */
export interface BasisOption { id: number; label: string; }
export interface StudyDrawingReviewInput { approve: boolean; note?: string | null; }

/** اعتماد المخططات الأولي (CDA) لنسخة معمارية — يُعدَّل ويُحذف قبل أول توقيع فقط */
export interface DesignApproval {
  id: number; versionId: number; versionLabel: string; drawingId: number; drawingName: string;
  projectId: number; projectCode: string; cdaNumber: string; cdaDate: string;
  content: string | null; technicalNotes: string | null; decision: StudyDecision; decisionName: string;
  createdByName: string; createdAt: string; updatedAt: string | null; rowVersion: string;
  canEdit: boolean; approvals: StudyApproval[];
}
export interface DesignApprovalInput {
  versionId: number; cdaDate: string; content?: string | null; technicalNotes?: string | null; rowVersion?: string | null;
}
