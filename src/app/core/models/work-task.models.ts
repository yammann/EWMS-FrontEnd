// تطابق Application/DTOs/Response/WorkTaskResponseDto.cs

/** بطاقة مهمة عمل (دورية/ثابتة) — تفتح صفحة المهمة، وحالياً "جاري العمل عليها" */
export interface WorkTaskCard {
  id: number;
  name: string;
  description: string;
  icon: string;
  branchName: string;
  assigneesCount: number;
}

export interface WorkTaskAssignee {
  userId: number;
  fullName: string;
  departmentName: string;
  officeName: string;
}

export interface WorkTask {
  id: number;
  name: string;
  description: string;
  icon: string;
  branchId: number;
  branchName: string;
  isActive: boolean;
  createdAt: string;
  assignees: WorkTaskAssignee[];
}

export interface WorkTaskRequest {
  name: string;
  description: string;
  icon: string;
  branchId: number;
  isActive: boolean;
  userIds: number[];
}
