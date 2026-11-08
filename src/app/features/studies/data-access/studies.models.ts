/**
 * فرع الدراسات المركزية — نسخة من DTOs الباكاند (CentralStudiesRequestDtos.cs وCentralStudiesResponseDtos.cs) وتعداداته
 * (Domain/Entities/CentralStudiesBranch/StudyEnums.cs). الأسماء العربية مطابقة لـ StudyRules.Name، والمخرجات
 * تحمل اسم كل قيمة (…Name) فلا تُترجم في الواجهة إلا قوائم الاختيار في النماذج والفلاتر.
 * أعلام Can… يحسبها الخادم لصلاحيات المستخدم وحالة السجل: الواجهة تعرض الأزرار بحسبها ولا تعيد حساب القواعد.
 * التواريخ نصوص ISO؛ تُرسل بصيغة yyyy-MM-dd. rowVersion نص Base64 يُعاد كما جاء عند الحفظ.
 */

export interface EnumOption<T extends number = number> { value: T; label: string; }

// ════════════════════ التعدادات ════════════════════

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

// ════════════════════ القوائم ════════════════════

/** نوع مرفق أو اختصاص هندسي */
export interface StudyLookup { id: number; name: string; isActive: boolean; }
export interface StudyLookupInput { name: string; isActive: boolean; }

export interface StudyStageType {
  id: number; name: string; defaultOrder: number; defaultWeight: number;
  linkedDocument: StudyLinkedDocument; linkedDocumentName: string; isActive: boolean;
}
export interface StudyStageTypeInput {
  name: string; defaultOrder: number; defaultWeight: number; linkedDocument: StudyLinkedDocument; isActive: boolean;
}

// ════════════════════ السلسلة والتواقيع ════════════════════

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

// ════════════════════ المستندات ════════════════════

export interface StudyDocumentFilter {
  status?: StudyDocumentStatus | null; search?: string | null; branchId?: number | null;
  from?: string | null; to?: string | null; page?: number; pageSize?: number;
}

/** فلاتر قائمة المشاريع (status = حالة المشروع 1 جارٍ … 4 ملغى) */
export interface StudyProjectFilter {
  status?: number | null; search?: string | null; branchId?: number | null; page?: number; pageSize?: number;
}

/** الحقول والأعلام المشتركة لكل مستند */
export interface StudyDocumentBase {
  status: StudyDocumentStatus; statusName: string;
  createdByUserId: number; createdByName: string; createdAt: string; updatedAt: string | null;
  rowVersion: string;
  canEdit: boolean; canDelete: boolean;
  /** يُرسل للاعتماد (أو يُسجَّل نهائياً للطلب) */
  canSubmit: boolean; canCancel: boolean;
  /** في التفاصيل فقط */
  chain: StudyChain | null;
  approvals: StudyApproval[];
}

/** طلب تجهيز الدراسة (REQ) */
export interface StudyRequest extends StudyDocumentBase {
  id: number; requestNumber: string; requestDate: string; urgency: number; urgencyName: string;
  /** رقم الطلب من الديوان المركزي (يدوي) */
  diwanRequestNumber: string | null;
  ministryArchiveNumber: string | null; ministryArchiveDate: string | null;
  adminArchiveNumber: string | null; adminArchiveDate: string | null;
  beneficiaryArchiveNumber: string | null; addedDate: string | null; entityCode: string | null;
  mainBeneficiary: string; subBeneficiary: string | null;
  governorateCode: string; governorateName: string; area: string | null; cityOrVillage: string | null;
  propertyNature: string | null; workType: number; workTypeName: string;
  followerName: string | null; followerPhone: string | null; notes: string | null;
  siteId: number | null; siteName: string | null; branchId: number; branchName: string;
  canCreateAssignment: boolean;
}
export interface StudyRequestInput {
  requestDate: string; urgency: number; diwanRequestNumber?: string | null;
  ministryArchiveNumber?: string | null; ministryArchiveDate?: string | null;
  adminArchiveNumber?: string | null; adminArchiveDate?: string | null;
  beneficiaryArchiveNumber?: string | null; addedDate?: string | null; entityCode?: string | null;
  mainBeneficiary: string; subBeneficiary?: string | null;
  governorateCode: string; area?: string | null; cityOrVillage?: string | null; propertyNature?: string | null;
  workType: number; followerName?: string | null; followerPhone?: string | null; notes?: string | null;
  siteId?: number | null;
  /** لنظرة المؤسسة فقط؛ غيرها يأخذ فرع المستخدم */
  branchId?: number | null;
  rowVersion?: string | null;
}

/** التكليف الداخلي (IPA) */
export interface StudyAssignment extends StudyDocumentBase {
  id: number; requestId: number; requestNumber: string; mainBeneficiary: string;
  branchId: number; branchName: string; followingDepartmentId: number; followingDepartmentName: string;
  assignmentNumber: string; assignmentDate: string; projectCode: string | null; allocatedBudget: number | null;
  scopeSummary: string;
  needsTechnicalEvaluation: boolean; needsResourceEstimate: boolean; needsPreliminaryBudget: boolean; needsFinalRecommendation: boolean;
  referralDate: string; responseDeadline: string; priority: number; priorityName: string;
  canCreateResponse: boolean;
}
export interface StudyAssignmentInput {
  requestId: number; followingDepartmentId: number; assignmentDate: string;
  projectCode?: string | null; allocatedBudget?: number | null; scopeSummary: string;
  needsTechnicalEvaluation: boolean; needsResourceEstimate: boolean; needsPreliminaryBudget: boolean; needsFinalRecommendation: boolean;
  referralDate: string; responseDeadline: string; priority: number;
  rowVersion?: string | null;
}

/** سطر نوع بناء: العدد والمساحة فقط (مساحة الموقع والتكلفة المبدئية حقلان للرد كله) */
export interface ResponseBuilding { buildingType: number; buildingTypeName: string; buildingCount: number; buildingsArea: number; }
export interface ResponseCostItem { id: number; sortOrder: number; description: string; unit: string; quantity: number; unitPrice: number; total: number; }
export interface ResponseStaff { disciplineId: number; disciplineName: string; staffCount: number; }
export interface StudyItem { id: number; item: string; quantity: number; note: string | null; }

/** إشعار الرد على التكليف */
export interface StudyResponse extends StudyDocumentBase {
  id: number; assignmentId: number; assignmentNumber: string; projectCode: string | null; requestId: number;
  branchId: number; branchName: string; followingDepartmentId: number; followingDepartmentName: string;
  responseDate: string; proposedManagerUserId: number | null; proposedManagerName: string | null;
  recommendation: number; recommendationName: string; requiredDays: number | null;
  /** RSP-yy-nnnn */
  responseNumber: string;
  siteArea: number | null; initialCost: number | null;
  /** مجموع جدول البنود (يحسبه الخادم) */
  totalCost: number;
  buildings: ResponseBuilding[]; costItems: ResponseCostItem[]; staffEstimates: ResponseStaff[]; logisticItems: StudyItem[];
  /** جزء القسم المتابع: مسودة أو مرفوض، لموظفي قسم التكليف */
  canEditFollowingPart: boolean;
  /** جزء التخطيط: وقّع القسم المتابع ولم يوقّع التخطيط (في التفاصيل فقط) */
  canEditPlanningPart: boolean;
  canCreateStartOrder: boolean;
}
/** جزء القسم المتابع: الجدولان يُستبدلان كاملين عند كل حفظ؛ المباني مبنيان على الأكثر */
export interface StudyResponseInput {
  assignmentId: number; responseDate: string; proposedManagerUserId?: number | null;
  recommendation: number; siteArea?: number | null; initialCost?: number | null;
  buildings: { buildingType: number; buildingCount: number; buildingsArea: number }[];
  costItems: { description: string; unit: string; quantity: number; unitPrice: number }[];
  rowVersion?: string | null;
}
/** جزء التخطيط وإدارة المشاريع (PUT UpdatePlanning): الكوادر والموارد اللوجستية والمدة، تُرسل كاملة */
export interface StudyResponsePlanningInput {
  requiredDays?: number | null;
  staffEstimates: { disciplineId: number; staffCount: number }[];
  logisticItems: StudyItemInput[];
  rowVersion?: string | null;
}
export interface StudyItemInput { item: string; quantity: number; note?: string | null; }

export interface StartOrderEngineer { engineerUserId: number; engineerName: string; disciplineId: number; disciplineName: string; }

/** أمر بدء الدراسة (PIO) */
export interface StudyStartOrder extends StudyDocumentBase {
  id: number; responseId: number; assignmentId: number; assignmentNumber: string; projectCode: string | null;
  requestId: number; branchId: number; branchName: string;
  competentDepartmentId: number; competentDepartmentName: string;
  projectManagerUserId: number; projectManagerName: string;
  orderNumber: string; orderDate: string; studyStartDate: string; studyDeadline: string;
  engineers: StartOrderEngineer[]; resources: StudyItem[];
  canCreateProject: boolean;
}
export interface StudyStartOrderInput {
  responseId: number; competentDepartmentId: number; projectManagerUserId: number;
  orderDate: string; studyStartDate: string; studyDeadline: string;
  engineers: { engineerUserId: number; disciplineId: number }[];
  resources: StudyItemInput[];
  rowVersion?: string | null;
}

/** أنواع المستندات الأربعة ومساراتها في الـ API */
export interface StudyDocumentKinds {
  requests: { item: StudyRequest; input: StudyRequestInput };
  assignments: { item: StudyAssignment; input: StudyAssignmentInput };
  responses: { item: StudyResponse; input: StudyResponseInput };
  startOrders: { item: StudyStartOrder; input: StudyStartOrderInput };
}
export type StudyDocumentKind = keyof StudyDocumentKinds;
export const STUDY_DOCUMENT_ROUTES: Record<StudyDocumentKind, string> = {
  requests: 'StudyRequests', assignments: 'StudyAssignments', responses: 'StudyResponses', startOrders: 'StudyStartOrders'
};

// ════════════════════ المشاريع ════════════════════

export interface ProjectMember { userId: number; fullName: string; roleTitle: string | null; assignedByName: string; assignedAt: string; }

/** موظف في قوائم الاختيار (موظف نشط من فرع الدراسة، بلا بيانات حساسة) — StudyLookups/Employees */
export interface StudyEmployee {
  id: number; fullName: string; departmentId: number | null; departmentName: string | null;
  officeId: number | null; officeName: string | null;
}
/** مكتب من مكاتب قسم مشارك (هدف «مكتب» في مهمة المرحلة) */
export interface StudyOfficeOption { id: number; name: string; }

export interface ProjectDepartment {
  id: number; departmentId: number; departmentName: string; addedByName: string; addedAt: string;
  members: ProjectMember[];
  /** مكاتب القسم مرتبة بالاسم (فارغة لقسم بلا مكاتب) */
  offices: StudyOfficeOption[];
  /** المستخدم الحالي يعيّن أعضاء هذا القسم (رئيسه) */
  canManageMembers: boolean;
}

/** مرحلة مشروع؛ النسبة يحسبها الخادم (مغلقة = 100) */
export interface ProjectStage {
  id: number; projectId: number; stageTypeId: number; stageTypeName: string; linkedDocument: StudyLinkedDocument;
  sortOrder: number; weight: number;
  plannedStartDate: string | null; plannedEndDate: string | null; actualStartDate: string | null; actualEndDate: string | null;
  status: StudyStageStatus; statusName: string; progress: number;
  responsibleDepartmentId: number | null; responsibleDepartmentName: string | null;
  closedByName: string | null; closedAt: string | null;
  tasksTotal: number; tasksDone: number; rowVersion: string;
}

export interface StudyProject {
  id: number; code: string; name: string; startOrderId: number; startOrderNumber: string;
  branchId: number; branchName: string; managerUserId: number; managerName: string;
  plannedStartDate: string; plannedEndDate: string; actualStartDate: string | null; actualEndDate: string | null;
  status: StudyProjectStatus; statusName: string; progress: number;
  createdByName: string; createdAt: string; updatedAt: string | null; rowVersion: string;
  canEdit: boolean; canDelete: boolean; canCancel: boolean;
  /** كل المراحل مغلقة ولا طلب إنجاز معلّق */
  canRequestCompletion: boolean;
  /** في التفاصيل فقط */
  chain: StudyChain | null;
  departments: ProjectDepartment[]; stages: ProjectStage[]; approvals: StudyApproval[];
}
export interface StudyProjectInput {
  startOrderId: number;
  /** يُطلب فقط إن لم يكن للتكليف كود */
  code?: string | null;
  name: string; plannedStartDate: string; plannedEndDate: string; actualStartDate?: string | null;
  managerUserId?: number | null; status?: StudyProjectStatus | null;
  rowVersion?: string | null;
}

export interface StudyStageInput {
  projectId: number; stageTypeId: number; weight: number;
  plannedStartDate?: string | null; plannedEndDate?: string | null; actualStartDate?: string | null;
  responsibleDepartmentId?: number | null; status?: StudyStageStatus | null;
  rowVersion?: string | null;
}

/** مهمة مرحلة؛ canUpdateProgress = هو المكلَّف (أو مكتبه أو قسمه) */
export interface StageTask {
  id: number; stageId: number; stageName: string; projectId: number; projectCode: string; projectName: string;
  targetType: StudyTaskTarget; targetTypeName: string; targetName: string;
  departmentId: number | null; officeId: number | null; assigneeUserId: number | null;
  assignedByName: string; title: string; description: string | null;
  plannedStartDate: string | null; plannedEndDate: string | null; actualStartDate: string | null; actualEndDate: string | null;
  progress: number; weight: number; status: StudyTaskStatus; statusName: string;
  createdAt: string; updatedAt: string | null; rowVersion: string;
  canEdit: boolean; canUpdateProgress: boolean;
}
/** جهة واحدة فقط حسب targetType (قسم أو مكتب أو موظف) */
export interface StageTaskInput {
  stageId: number; targetType: StudyTaskTarget;
  departmentId?: number | null; officeId?: number | null; assigneeUserId?: number | null;
  title: string; description?: string | null; plannedStartDate?: string | null; plannedEndDate?: string | null;
  weight: number; rowVersion?: string | null;
}
export interface StageTaskProgressInput { progress: number; status: StudyTaskStatus; }

// ════════════════════ المخططات واعتمادها ════════════════════

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
  description?: string | null; officeId?: number | null; departmentId?: number | null; basedOnVersionId?: number | null;
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

// ════════════════════ المرفقات والسجل ════════════════════

export interface StudyAttachment {
  id: number; ownerType: StudyOwnerType; ownerId: number; attachmentTypeId: number; attachmentTypeName: string;
  fileName: string; contentType: string;
  /** بالبايت */
  size: number;
  previewable: boolean; uploadedByName: string; uploadedAt: string; canDelete: boolean;
}

export interface StudyActivityLog {
  id: number; entityType: number; entityTypeName: string; entityId: number;
  action: number; actionName: string; title: string; details: string | null;
  userId: number; userName: string; createdAt: string;
}

// ════════════════════ الطباعة ════════════════════

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
