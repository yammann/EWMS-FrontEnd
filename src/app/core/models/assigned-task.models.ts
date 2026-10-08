// تطابق Application/DTOs/Response/AssignedTaskResponseDtos.cs — لوحة المهام (إسناد نزولاً في الهيكل)

export type TaskStatus = 'Todo' | 'InProgress' | 'InReview' | 'Done';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskBoardMode = 'incoming' | 'outgoing' | 'scope';

/** قيم الـ API الرقمية */
export const TASK_STATUS_VALUE: Record<TaskStatus, number> = { Todo: 1, InProgress: 2, InReview: 4, Done: 3 };
export const TASK_PRIORITY_VALUE: Record<TaskPriority, number> = { Low: 1, Normal: 2, High: 3, Urgent: 4 };

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  Todo: 'لم تُنفَّذ', InProgress: 'قيد التنفيذ', InReview: 'بانتظار المراجعة', Done: 'تم التنفيذ'
};

/** المرفقات (قرار المستخدم 2026-10-07): تطابق TaskAttachmentRules في الباكاند — التحقق النهائي من محتوى الملف في الخادم */
export const TASK_ATTACHMENTS = {
  maxFiles: 10,
  maxBytes: 10 * 1024 * 1024,
  accept: '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
} as const;

/** نص تعذّر قبول ملف قبل رفعه (الحجم، أو الامتداد)، أو null إن كان مقبولاً */
export function attachmentProblem(file: File): string | null {
  if (file.size === 0) return `الملف «${file.name}» فارغ`;
  if (file.size > TASK_ATTACHMENTS.maxBytes) return `الملف «${file.name}» أكبر من 10MB`;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return TASK_ATTACHMENTS.accept.split(',').includes('.' + ext) ? null : `الملف «${file.name}» نوعه غير مسموح (PDF أو صور أو Word أو Excel أو PowerPoint)`;
}
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  Low: 'منخفضة', Normal: 'عادية', High: 'مرتفعة', Urgent: 'عاجلة'
};

export interface AssignedTaskCard {
  id: number;
  title: string;
  priority: TaskPriority;
  priorityAr: string;
  status: TaskStatus;
  statusAr: string;
  dueDate: string | null;
  isOverdue: boolean;
  targetType: 'Department' | 'Office' | 'User';
  targetName: string;
  targetPath: string;
  createdByUserId: number;
  createdByName: string;
  parentTaskId: number | null;
  parentTitle: string | null;
  subTasksTotal: number;
  subTasksDone: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canChangeStatus: boolean;
  /** الحالات التي أستطيع نقل المهمة إليها الآن — منها يُبنى السحب والأزرار (يحسبها الخادم) */
  allowedStatuses: TaskStatus[];
  /** إعادتها من المراجعة إلى التنفيذ مني (المُسنِد) تحتاج سبباً */
  needsReturnNote: boolean;
  attachmentsCount: number;
  checklistTotal: number;
  checklistDone: number;
  claimedByUserId: number | null;
  claimedByName: string | null;
}

export interface AssignedTaskActivity {
  id: number;
  type: 'Created' | 'StatusChanged' | 'Comment' | 'Delegated' | 'Edited' | 'Attached' | 'AttachmentRemoved' | 'Claimed' | 'Released';
  text: string;
  userName: string;
  createdAt: string;
}

export interface AssignedTaskDetail extends AssignedTaskCard {
  description: string;
  startedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canComment: boolean;
  canDelegate: boolean;
  subTasks: AssignedTaskCard[];
  activities: AssignedTaskActivity[];
  attachments: TaskAttachment[];
  /** مرفقات المهمة الأصل للقراءة فقط (للمهمة الفرعية) */
  parentAttachments: TaskAttachment[];
  checklist: ChecklistItem[];
  canAttach: boolean;
  canManageChecklist: boolean;
  canClaim: boolean;
  canRelease: boolean;
}

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  contentType: string;
  size: number;
  uploadedByName: string;
  uploadedAt: string;
  canDelete: boolean;
}

export interface ChecklistItem { id: number; text: string; isDone: boolean; }

export interface TaskTargetOption {
  id: number;
  name: string;
  headNames: string;
}

export type TaskTargetKind = 'Department' | 'Office' | 'User';

export interface TaskTargetType {
  value: TaskTargetKind;
  label: string;
}

export interface TaskBoard {
  mode: TaskBoardMode;
  canCreate: boolean;
  targetTypeLabel: string;
  /** أنواع الإسناد المتاحة لي حسب صلاحياتي (AssignTaskToDepartment / Office / User) */
  targetTypes: TaskTargetType[];
  /** يظهر تبويب "كل مهام نطاقي" */
  hasScope: boolean;
  tasks: AssignedTaskCard[];
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: number;
  dueDate: string | null;
  targetId: number;
  /** مطلوب إن كان لي أكثر من نوع إسناد — يُتجاهل في التفويض */
  targetType?: TaskTargetKind | null;
  parentTaskId: number | null;
}

export interface UpdateTaskRequest {
  title: string;
  description: string;
  priority: number;
  dueDate: string | null;
}
