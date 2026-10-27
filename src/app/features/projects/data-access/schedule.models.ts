/** حالات الجدول (ScheduleStatus) */
export const SCHEDULE_DRAFT = 1, SCHEDULE_APPROVED = 2, SCHEDULE_SUPERSEDED = 3;

/** حالات البند (ScheduleTaskStatus) */
export const TASK_STATUSES = [
  { value: 1, label: 'لم يبدأ' },
  { value: 2, label: 'قيد التنفيذ' },
  { value: 3, label: 'مكتمل' },
  { value: 4, label: 'موقوف' }
] as const;
export const TASK_COMPLETED = 3;

/** نوع التأخير (DelayKind) وحالته (DelayStatus) */
export const DELAY_UNJUSTIFIED = 1, DELAY_JUSTIFIED = 2;
export const DELAY_RECORDED = 1, DELAY_SUBMITTED = 2, DELAY_APPROVED = 3, DELAY_REJECTED = 4, DELAY_RESOLVED = 5;

/** التمديد: النوع (ExtensionMode) وعدّ الأيام (ExtensionDayCount) وحالة الطلب (ExtensionStatus) */
export const EXT_GROUP = 1, EXT_SINGLE = 2;
export const EXT_CALENDAR = 1, EXT_WORKING = 2;
export const EXT_DRAFT = 1, EXT_SUBMITTED = 2, EXT_APPROVED = 3, EXT_REJECTED = 4;

export interface StartOrder {
  id: number; projectId: number; orderNumber: string; orderDate: string; startDate: string;
  completionDays: number; executionDays: number; studyCost: number | null;
  siteEngineerUserId: number | null; siteEngineerName: string | null;
  sectorSupervisorUserId: number | null; sectorSupervisorName: string | null;
  notes: string; createdByName: string; createdAt: string; updatedAt: string; rowVersion: string;
}

export interface StartOrderInput {
  orderNumber: string; orderDate: string; startDate: string; completionDays: number; executionDays: number; studyCost: number | null;
  siteEngineerUserId: number | null; sectorSupervisorUserId: number | null; notes: string; rowVersion?: string;
}

export interface ScheduleVersion {
  id: number; versionNumber: number; title: string; note: string; status: number; statusName: string;
  createdByName: string; createdAt: string; approvedByName: string | null; approvedAt: string | null;
  taskCount: number; actualProgress: number;
}

export interface ScheduleOverview {
  projectId: number; projectNumber: string; projectName: string; projectFinished: boolean;
  startOrder: StartOrder | null; versions: ScheduleVersion[];
  approvedScheduleId: number | null; draftScheduleId: number | null;
  actualProgress: number | null; plannedProgress: number | null; baselineProgress: number | null; overdueCandidates: number;
  canEditStartOrder: boolean; canEditSchedule: boolean;
}

export interface ScheduleTask {
  id: number; sortOrder: number; code: string; name: string;
  plannedStart: string; plannedEnd: string; originalStart: string | null; originalEnd: string | null; extraDays: number;
  weight: number; isCritical: boolean; status: number; statusName: string; progress: number;
  actualStart: string | null; actualEnd: string | null; note: string;
  assigneeUserId: number | null; assigneeName: string | null;
  isOverdueCandidate: boolean; datesLocked: boolean; rowVersion: string;
}

export interface ScheduleDependency { id: number; predecessorId: number; successorId: number; hasConflict: boolean; }

export interface ScheduleDetail {
  id: number; projectId: number; projectNumber: string; projectName: string; versionNumber: number; title: string; note: string;
  status: number; statusName: string; createdByUserId: number; createdByName: string; createdAt: string;
  approvedByName: string | null; approvedAt: string | null; rowVersion: string;
  actualProgress: number; plannedProgress: number; baselineProgress: number; overdueCandidates: number;
  warnings: string[]; tasks: ScheduleTask[]; dependencies: ScheduleDependency[];
  canEdit: boolean; canApprove: boolean; canUpdateProgress: boolean; canClassify: boolean;
}

export interface TaskInput {
  code: string; name: string; plannedStart: string; plannedEnd: string; weight: number; note: string;
  assigneeUserId: number | null; rowVersion?: string;
}

export interface ProgressInput {
  status: number; progress: number; actualStart: string | null; actualEnd: string | null; note: string; rowVersion?: string;
}

export interface ProgressEntry {
  id: number; progress: number; status: number; statusName: string; note: string; userName: string; createdAt: string;
}

export interface AffectedTask { taskId: number; code: string; name: string; }

export interface ScheduleDelay {
  id: number; projectId: number; taskId: number; taskCode: string; taskName: string; scheduleId: number; scheduleVersion: number;
  kind: number; kindName: string; status: number; statusName: string;
  discoveredAt: string; plannedEndAtDiscovery: string; daysLate: number;
  reason: string; actions: string; approvalAuthority: string; approvalDate: string | null;
  approvalDocumentVersionId: number | null; approvalDocumentTitle: string | null; affectsCriticalWork: boolean;
  affectedTasks: AffectedTask[]; suggestedTasks: AffectedTask[] | null;
  recordedByUserId: number; recordedByName: string; recordedAt: string;
  decidedByName: string | null; decidedAt: string | null; decisionNote: string; rowVersion: string;
  canJustify: boolean; canDecide: boolean;
}

export interface DelayInput { kind: number; discoveredAt: string; reason: string; actions: string; affectedTaskIds: number[]; }

export interface JustifyInput {
  reason: string; actions: string; approvalAuthority: string; approvalDate: string; approvalDocumentVersionId: number | null;
  affectsCriticalWork: boolean; affectedTaskIds: number[]; rowVersion?: string;
}

export interface DecisionInput { approve: boolean; note: string; rowVersion?: string; }

export interface ExtensionItem {
  taskId: number; taskCode: string; taskName: string; days: number; movesStart: boolean;
  oldStart: string; oldEnd: string; newStart: string; newEnd: string;
}
export interface ExtensionDocument { versionId: number; documentTitle: string; fileName: string; versionNumber: number; isApproved: boolean; }
export interface ScheduleConflict { predecessorId: number; successorId: number; predecessorName: string; successorName: string; }

export interface ScheduleExtension {
  id: number; projectId: number; scheduleId: number; delayId: number | null;
  mode: number; modeName: string; dayCount: number; dayCountName: string; status: number; statusName: string; reason: string;
  requestedByUserId: number; requestedByName: string; requestedAt: string;
  decidedByName: string | null; decidedAt: string | null; decisionNote: string;
  items: ExtensionItem[]; documents: ExtensionDocument[]; conflicts: ScheduleConflict[]; suggestedTasks: AffectedTask[];
  staleProblem: string | null; rowVersion: string; canEdit: boolean; canDecide: boolean;
}

export interface ExtensionPreview { items: ExtensionItem[]; conflicts: ScheduleConflict[]; suggestedTasks: AffectedTask[]; }

export interface ExtensionLineInput { taskId: number; days: number; movesStart: boolean; }
export interface ExtensionInput {
  delayId: number | null; mode: number; dayCount: number; reason: string; lines: ExtensionLineInput[];
  documentVersionIds: number[]; rowVersion?: string;
}

/** «2026-11-05T00:00:00» ← «2026-11-05» (قيمة حقل التاريخ) */
export const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

/** مؤشر الجدول بأرقام لا تتجاوز خانة عشرية واحدة */
export const percent = (value: number | null | undefined) => (value == null ? '—' : `${Math.round(value * 10) / 10}%`);
