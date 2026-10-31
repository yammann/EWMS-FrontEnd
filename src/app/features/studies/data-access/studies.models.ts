/** ترتيب المخرجات: يقرره رئيس القسم لكل أمر (قيم StudyMode في الخادم) */
export const STUDY_MODES = [
  { value: 1, label: 'بالتسلسل', hint: 'لا يبدأ مخرج قبل اعتماد ما قبله في الترتيب' },
  { value: 2, label: 'بالتوازي', hint: 'تُعدّ كل المخرجات معاً' }
] as const;

/** حالة أمر الدراسة (StudyStatus) — لا تنتقل بمرور الوقت بل بإرسال أو قرار يسجّله مخوَّل */
export const STUDY_STATUS = { open: 1, sent: 2, approved: 3, returned: 4, cancelled: 5 } as const;
export const STUDY_STATUSES = [
  { value: 1, label: 'قيد الإعداد' }, { value: 2, label: 'أُرسلت للمركزية' }, { value: 3, label: 'اعتمدتها المركزية' },
  { value: 4, label: 'أعادتها بملاحظات' }, { value: 5, label: 'ملغاة' }
] as const;

/** حالة المخرج (DeliverableState): إعداد ← مراجعة ← معتمد أو معاد */
export const DELIVERABLE_STATE = { preparing: 1, inReview: 2, approved: 3, returned: 4 } as const;

/** قرار المركزية (CenterDecision): يُسجَّل يدوياً */
export const CENTER_DECISION = { pending: 1, approved: 2, notes: 3 } as const;

export interface DeliverableType {
  branchId: number; documentKind: number; documentKindAr: string; id: number; isActive: boolean; name: string; rowVersion: string; sortOrder: number;
}

export interface DeliverableTypeInput {
  branchId: number | null; documentKind: number; isActive: boolean; name: string; sortOrder: number;
}

export interface StudyItem {
  approvedPercent: number; branchId: number; correspondenceId: number | null; correspondenceNumber: string | null; createdAt: string;
  deliverablesApproved: number; deliverablesTotal: number; dueDate: string | null; externalNumber: string | null; id: number; isOverdue: boolean;
  mode: number; modeAr: string; number: string; projectId: number; projectName: string; status: number; statusAr: string; title: string;
}

export interface StudyDeliverable {
  approvedVersionId: number | null; approvedVersionNumber: number | null; assigneeName: string | null; assigneeUserId: number | null;
  blockedByName: string | null; canAttachDocument: boolean; canEdit: boolean; canPrepare: boolean; canRemove: boolean; canReview: boolean;
  canSendBack: boolean; canSubmit: boolean; documentId: number | null; dueDate: string | null; id: number; isOverdue: boolean;
  latestVersionId: number | null; latestVersionNumber: number | null; note: string; officeId: number | null; officeName: string | null;
  returnNote: string | null; reviewedAt: string | null; reviewedByName: string | null; rowVersion: string; sortOrder: number;
  state: number; stateAr: string; submittedAt: string | null; submittedByName: string | null; submittedVersionId: number | null;
  submittedVersionNumber: number | null; typeId: number; typeName: string;
}

export interface StudySubmission {
  decidedAt: string | null; decidedByName: string | null; decision: number; decisionAr: string; decisionNote: string; decisionVersionId: number | null;
  id: number; note: string; outgoingCorrespondenceId: number | null; outgoingCorrespondenceNumber: string | null; round: number;
  rowVersion: string; sentAt: string; sentByName: string;
}

export interface Study extends StudyItem {
  canAddDeliverable: boolean; canCancel: boolean; canDecide: boolean; canEdit: boolean; canReopen: boolean; canSend: boolean;
  createdByName: string; deliverables: StudyDeliverable[]; notes: string; rowVersion: string; submissions: StudySubmission[];
}

export interface StudyInput {
  projectId: number; correspondenceId: number | null; externalNumber: string | null; title: string; notes: string | null;
  mode: number; dueDate: string | null; rowVersion?: string | null;
}

export interface DeliverableInput {
  typeId: number; officeId: number | null; assigneeUserId: number | null; dueDate: string | null; note: string | null;
  sortOrder: number | null; rowVersion?: string | null;
}

export interface StudyFilter {
  projectId: number | null; status: number | null; search: string; overdueOnly: boolean; mine: boolean; page: number; pageSize: number;
}

/** صفحة الدراسات للقراءة: من يملك أي صلاحية دراسات (الحدّ حدّ رؤية المشروع) */
export interface StudyAccess {
  canView: boolean; canCreate: boolean; canEdit: boolean; canPrepare: boolean; canReview: boolean; canSend: boolean;
  canViewTypes: boolean; canManageTypes: boolean; canCreateType: boolean; canEditType: boolean; canDeleteType: boolean;
  /** يختار الفرع في إعدادات الأنواع (نظرة المؤسسة) */
  canChooseBranch: boolean;
}
