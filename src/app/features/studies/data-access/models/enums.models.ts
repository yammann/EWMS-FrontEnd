/** فرع الدراسات المركزية — التعدادات (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */

export interface EnumOption<T extends number = number> { value: T; label: string; }

export const StudyDocumentStatus = { Draft: 1, PendingApproval: 2, Approved: 3, Rejected: 4, Cancelled: 5 } as const;
export type StudyDocumentStatus = (typeof StudyDocumentStatus)[keyof typeof StudyDocumentStatus];
export const DOCUMENT_STATUSES: readonly EnumOption<StudyDocumentStatus>[] = [
  { value: 1, label: 'مسودة' }, { value: 2, label: 'بانتظار الاعتماد' }, { value: 3, label: 'معتمد' },
  { value: 4, label: 'مرفوض' }, { value: 5, label: 'ملغى' }
];

export const URGENCIES: readonly EnumOption[] = [{ value: 1, label: 'مستعجل' }, { value: 2, label: 'عادي' }];
export const WORK_TYPES: readonly EnumOption[] = [{ value: 1, label: 'إنشاء' }, { value: 2, label: 'صيانة وترميم' }];
export const PRIORITIES: readonly EnumOption[] = [
  { value: 1, label: 'عاجل جداً وسري' }, { value: 2, label: 'عاجل' }, { value: 3, label: 'عادي' }
];

/** توصية الرد: «غير متاح» (3) لا يُصدر بعدها أمر بدء */
export const StudyRecommendation = { Accept: 1, Modify: 2, NotAvailable: 3 } as const;
export const RECOMMENDATIONS: readonly EnumOption[] = [{ value: 1, label: 'قبول' }, { value: 2, label: 'تعديل' }, { value: 3, label: 'غير متاح' }];
export const BUILDING_TYPES: readonly EnumOption[] = [{ value: 1, label: 'إعادة تأهيل' }, { value: 2, label: 'إنشاء جديد' }];

export const StudyProjectStatus = { Running: 1, Suspended: 2, Completed: 3, Cancelled: 4 } as const;
export type StudyProjectStatus = (typeof StudyProjectStatus)[keyof typeof StudyProjectStatus];
/** ما يختاره المستخدم في تعديل المشروع (الإكمال والإلغاء بإجراءاتهما) */
export const EDITABLE_PROJECT_STATUSES: readonly EnumOption<StudyProjectStatus>[] = [{ value: 1, label: 'جارٍ' }, { value: 2, label: 'معلّق' }];

export const StudyStageStatus = { NotStarted: 1, InProgress: 2, Closed: 3 } as const;
export type StudyStageStatus = (typeof StudyStageStatus)[keyof typeof StudyStageStatus];

export const StudyTaskStatus = { NotStarted: 1, InProgress: 2, Done: 3 } as const;
export type StudyTaskStatus = (typeof StudyTaskStatus)[keyof typeof StudyTaskStatus];
export const TASK_STATUSES: readonly EnumOption<StudyTaskStatus>[] = [
  { value: 1, label: 'لم تبدأ' }, { value: 2, label: 'قيد التنفيذ' }, { value: 3, label: 'منجزة' }
];

/** جهة المهمة: قسم مشارك، مكتب من قسم مشارك، أو عضو في الفريق */
export const StudyTaskTarget = { Department: 1, Office: 2, User: 3 } as const;
export type StudyTaskTarget = (typeof StudyTaskTarget)[keyof typeof StudyTaskTarget];
export const TASK_TARGETS: readonly EnumOption<StudyTaskTarget>[] = [{ value: 1, label: 'قسم' }, { value: 2, label: 'مكتب' }, { value: 3, label: 'موظف' }];

export const DrawingKind = { Architectural: 1, Structural: 2, Mep: 3, Interior: 4, Technical: 5 } as const;
export type DrawingKind = (typeof DrawingKind)[keyof typeof DrawingKind];
export const DRAWING_KINDS: readonly EnumOption<DrawingKind>[] = [
  { value: 1, label: 'معماري' }, { value: 2, label: 'إنشائي' }, { value: 3, label: 'كهرباء وميكانيك' },
  { value: 4, label: 'تصميم داخلي' }, { value: 5, label: 'تقني' }
];

export const DrawingStatus = { InPreparation: 1, PendingReview: 2, Approved: 3, Rejected: 4 } as const;
export type DrawingStatus = (typeof DrawingStatus)[keyof typeof DrawingStatus];

/** قرار موقّع: «معتمد مع ملاحظات» والرفض يحتاجان ملاحظة */
export const StudyDecision = { Pending: 1, Approved: 2, ApprovedWithNotes: 3, Rejected: 4 } as const;
export type StudyDecision = (typeof StudyDecision)[keyof typeof StudyDecision];
export const DECISIONS: readonly (EnumOption<StudyDecision> & { needsNote: boolean })[] = [
  { value: 2, label: 'معتمد', needsNote: false },
  { value: 3, label: 'معتمد مع ملاحظات', needsNote: true },
  { value: 4, label: 'مرفوض', needsNote: true }
];

/** المستند الذي تمثّله مرحلة المشروع (0 = مرحلة عمل عادية؛ غيره = مرحلة تُنشأ مغلقة بتواريخ مستندها) */
export const StudyLinkedDocument = { None: 0, Request: 1, Assignment: 2, Response: 3, StartOrder: 4 } as const;
export type StudyLinkedDocument = (typeof StudyLinkedDocument)[keyof typeof StudyLinkedDocument];
export const LINKED_DOCUMENTS: readonly EnumOption<StudyLinkedDocument>[] = [
  { value: 0, label: 'لا شيء' }, { value: 1, label: 'طلب تجهيز الدراسة' }, { value: 2, label: 'التكليف الداخلي' },
  { value: 3, label: 'إشعار الرد' }, { value: 4, label: 'أمر البدء' }
];

/** صاحب التواقيع والمرفقات والسجل (StudyEntityType) */
export const StudyOwnerType = {
  Request: 1, Assignment: 2, Response: 3, StartOrder: 4, Project: 5, Drawing: 8, Version: 9, DesignApproval: 10
} as const;
export type StudyOwnerType = (typeof StudyOwnerType)[keyof typeof StudyOwnerType];
