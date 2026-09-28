// تطابق Application/DTOs/Response/AssignedTaskResponseDtos.cs — لوحة المهام (إسناد نزولاً في الهيكل)

export type TaskStatus = 'Todo' | 'InProgress' | 'Done';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskBoardMode = 'incoming' | 'outgoing' | 'scope';

/** قيم الـ API الرقمية */
export const TASK_STATUS_VALUE: Record<TaskStatus, number> = { Todo: 1, InProgress: 2, Done: 3 };
export const TASK_PRIORITY_VALUE: Record<TaskPriority, number> = { Low: 1, Normal: 2, High: 3, Urgent: 4 };

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  Todo: 'لم تُنفَّذ', InProgress: 'قيد التنفيذ', Done: 'تم التنفيذ'
};
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
}

export interface AssignedTaskActivity {
  id: number;
  type: 'Created' | 'StatusChanged' | 'Comment' | 'Delegated' | 'Edited';
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
}

export interface TaskTargetOption {
  id: number;
  name: string;
  headNames: string;
}

export interface TaskBoard {
  mode: TaskBoardMode;
  canCreate: boolean;
  targetTypeLabel: string;
  tasks: AssignedTaskCard[];
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: number;
  dueDate: string | null;
  targetId: number;
  parentTaskId: number | null;
}

export interface UpdateTaskRequest {
  title: string;
  description: string;
  priority: number;
  dueDate: string | null;
}
