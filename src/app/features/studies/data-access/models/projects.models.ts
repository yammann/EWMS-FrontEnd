/** فرع الدراسات المركزية — المشاريع (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyApproval, StudyChain } from './chain.models';
import { StudyLinkedDocument, StudyProjectStatus, StudyStageStatus, StudyTaskStatus, StudyTaskTarget } from './enums.models';

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
  /** العدد الكلي ونسبة المرحلة كاملان وإن لم تظهر لي كل مهامها */
  tasksTotal: number; tasksDone: number; rowVersion: string;
  /** إضافة مهمة: للقسم المسؤول عن المرحلة (أو مدير النظام) والمشروع والمرحلة مفتوحان */
  canAddTask: boolean;
}

export interface StudyProject {
  id: number; code: string; name: string; startOrderId: number; startOrderNumber: string;
  branchId: number; branchName: string; managerUserId: number; managerName: string;
  plannedStartDate: string; plannedEndDate: string; actualStartDate: string | null; actualEndDate: string | null;
  status: StudyProjectStatus; statusName: string; progress: number;
  createdByName: string; createdAt: string; updatedAt: string | null; rowVersion: string;
  canEdit: boolean; canDelete: boolean; canCancel: boolean;
  /** أرى المشروع كاملاً؛ وإلا فمراحلي ومهامي وفريقي بحسب viewLevel (1 كاملة، 2 مهام القسم، 3 مهام المكتب، 4 مهامي) */
  canViewFull: boolean; viewLevel: 1 | 2 | 3 | 4; viewLevelName: string;
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
