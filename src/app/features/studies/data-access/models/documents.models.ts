/** فرع الدراسات المركزية — المستندات (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyApproval, StudyChain } from './chain.models';
import { StudyDocumentStatus } from './enums.models';

export interface StudyDocumentFilter {
  status?: StudyDocumentStatus | null; search?: string | null; branchId?: number | null;
  from?: string | null; to?: string | null; page?: number; pageSize?: number;
}

/** فلاتر قائمة المشاريع (status = حالة المشروع 1 جارٍ … 4 ملغى) */
export interface StudyProjectFilter {
  status?: number | null; search?: string | null; branchId?: number | null;
  /** مشاريع موقع واحد من سجل المواقع (لنافذة «دراسات الموقع» على الخريطة) */
  siteId?: number | null; page?: number; pageSize?: number;
}

/** موظف في «من يوقّع أو يصدر التالي»: الاسم والقسم والمسمّى فقط (المدير العام لا يظهر أبداً) */
export interface StudyPerson { id: number; fullName: string; departmentName: string | null; jobTitle: string | null; }

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
  /** من يوقّع الآن (بانتظار الاعتماد) وعددهم الكلي؛ null = لا ينطبق، وقائمة فارغة = لا أحد يملك صلاحية الصفة */
  nextSigners?: StudyPerson[] | null; nextSignersTotal?: number;
  /** من يصدر المستند التالي (معتمد ولم يصدر) وعددهم الكلي؛ null = لا ينطبق، وقائمة فارغة = لا أحد يملك صلاحية الإصدار */
  nextIssuers?: StudyPerson[] | null; nextIssuersTotal?: number;
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
