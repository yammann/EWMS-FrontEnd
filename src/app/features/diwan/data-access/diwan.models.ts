/** اتجاه المعاملة (مطابق لـ CorrespondenceDirection في الباكاند؛ القيم المخزّنة لا تُعاد استعمالها) */
export const DIRECTIONS = [{ value: 1, label: 'وارد' }, { value: 2, label: 'صادر' }] as const;
export const INCOMING = 1;
export const OUTGOING = 2;

/** مراحل الحالة (ثابتة، عليها يعتمد السلوك): الفرع يسمّي حالاته ويعيّن لكل واحدة مرحلة */
export const STAGES = [
  { value: 1, label: 'مسجّلة' },
  { value: 2, label: 'قيد المعالجة' },
  { value: 3, label: 'تمّت الإجابة' },
  { value: 4, label: 'مغلقة' }
] as const;

/** المرحلة التي يلزم لها صلاحية الإغلاق */
export const CLOSED_STAGE = 4;

/** مراحل الصادر: مسودة ← معتمد بتوقيع ← صادر برقمه */
export const OUTGOING_STATES = { draft: 1, approved: 2, issued: 3 } as const;

export interface CorrespondenceType { id: number; branchId: number; name: string; deadlineDays: number | null; isActive: boolean; sortOrder: number; }
export interface CorrespondenceTypeInput { branchId?: number | null; name: string; deadlineDays: number | null; isActive: boolean; sortOrder: number; }

export interface CorrespondenceStatus { id: number; branchId: number; name: string; stage: number; stageAr: string; color: string; isActive: boolean; sortOrder: number; }
export interface CorrespondenceStatusInput { branchId?: number | null; name: string; stage: number; color: string; isActive: boolean; sortOrder: number; }

/** صف القائمة */
export interface CorrespondenceItem {
  id: number;
  /** IN-2026-00012 أو OUT-…؛ null لمسودة لم تصدر */
  number: string | null;
  direction: number;
  directionAr: string;
  branchId: number;
  subject: string;
  party: string;
  externalNumber: string | null;
  typeId: number;
  typeName: string;
  statusId: number | null;
  statusName: string | null;
  statusColor: string | null;
  stage: number | null;
  outgoingState: number | null;
  outgoingStateAr: string | null;
  /** مسودة صادر رُفعت للاعتماد وبانتظار قرار المعتمِد */
  isSubmitted: boolean;
  projectId: number | null;
  projectName: string | null;
  currentUnitName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  isClosed: boolean;
  registeredAt: string;
  registeredByName: string;
}

export interface Referral {
  id: number;
  fromUserId: number;
  fromUserName: string;
  fromDepartmentName: string | null;
  toDepartmentId: number;
  toDepartmentName: string;
  toOfficeId: number | null;
  toOfficeName: string | null;
  toUserId: number | null;
  toUserName: string | null;
  note: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
}

export interface CorrespondenceAttachment { id: number; fileName: string; contentType: string; size: number; uploadedByName: string; uploadedAt: string; }

/** تفصيل المعاملة مع ما يحق للمستخدم فعله عليها الآن (تحسبه الخدمة، فلا تكرّر الواجهة القواعد) */
export interface Correspondence extends CorrespondenceItem {
  summary: string;
  externalDate: string | null;
  replyToId: number | null;
  replyToNumber: string | null;
  currentDepartmentId: number | null;
  currentOfficeId: number | null;
  currentUserId: number | null;
  currentUserName: string | null;
  returnNote: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  closedAt: string | null;
  referrals: Referral[];
  attachments: CorrespondenceAttachment[];
  canEdit: boolean;
  canRefer: boolean;
  canAcknowledge: boolean;
  canChangeStatus: boolean;
  canClose: boolean;
  canAttach: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canIssue: boolean;
  rowVersion: string;
}

export interface HistoryEntry { id: number; at: string; userName: string; action: string; title: string; details: string; }

export interface ReferralOffice { id: number; name: string; }
export interface ReferralDepartment { id: number; name: string; offices: ReferralOffice[]; }
export interface ReferralUser { id: number; fullName: string; officeName: string | null; }

export interface CorrespondenceFilter {
  direction: number | null;
  typeId: number | null;
  statusId: number | null;
  stage: number | null;
  projectId: number | null;
  search: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  /** صندوقي الوارد: ما تحمله وحدتي الآن ولم يُغلق */
  inbox: boolean;
  page: number;
  pageSize: number;
}

export interface RegisterIncomingInput {
  branchId?: number | null;
  typeId: number;
  party: string;
  subject: string;
  summary: string;
  externalNumber: string;
  externalDate: string | null;
  projectId: number | null;
}

export interface CreateDraftInput {
  branchId?: number | null;
  typeId: number;
  party: string;
  subject: string;
  summary: string;
  externalNumber: string;
  projectId: number | null;
  replyToId: number | null;
}

export interface UpdateCorrespondenceInput {
  typeId: number;
  party: string;
  subject: string;
  summary: string;
  externalNumber: string;
  externalDate: string | null;
  projectId: number | null;
  replyToId: number | null;
  rowVersion: string;
}

export interface ReferInput { toDepartmentId: number; toOfficeId: number | null; toUserId: number | null; note: string; }

/** بيانات طباعة الكتاب الصادر المعتمد (GET Correspondence/Print/{id}) */
export interface CorrespondencePrint {
  number: string | null;
  isIssued: boolean;
  branchName: string;
  dateHijri: string;
  date: string;
  externalNumber: string | null;
  replyToNumber: string | null;
  party: string;
  subject: string;
  body: string;
  approverName: string | null;
  /** توقيع المعتمِد لحظة الاعتماد (صورة)، أو null إن اعتُمد بلا توقيع مرفوع */
  approverSignature: string | null;
}

/** مشروع للاختيار في نماذج الديوان (رقمه واسمه فقط) */
export interface ProjectOption { id: number; number: string; name: string; }
