import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { PagedResult } from '@core/models/paged-result.model';
import { query } from '../utils/query';
import {
  ProjectStage, StageTask, StageTaskInput, StageTaskProgressInput, StudyActivityLog,
  StudyProject, StudyProjectFilter, StudyProjectInput, StudyStageInput
} from './studies.models';

/**
 * مشاريع الدراسات: المشروع يُنشأ من أمر بدء معتمد، وفريقه أقسام مشاركة لكل منها أعضاء يعيّنهم رئيس القسم،
 * ومراحله متتابعة (تُغلق بالترتيب)، ومهام كل مرحلة لقسم مشارك أو مكتب منه أو عضو في الفريق.
 * نسب الإنجاز يحسبها الخادم من الأوزان؛ عمليات الفريق تعيد تفاصيل المشروع كاملة.
 */
@Injectable({ providedIn: 'root' })
export class StudyProjectsService {
  private api = inject(ApiService);

  // ─────────── المشروع ───────────
  list(filter: StudyProjectFilter = {}) { return this.api.get<PagedResult<StudyProject>>('/StudyProjects/GetAll' + query(filter)); }
  get(id: number) { return this.api.get<StudyProject>(`/StudyProjects/Get/${id}`); }
  create(body: StudyProjectInput) { return this.api.post<StudyProject>('/StudyProjects/Create', body); }
  update(id: number, body: StudyProjectInput) { return this.api.put<StudyProject>(`/StudyProjects/Update/${id}`, body); }
  remove(id: number) { return this.api.delete<{ message: string }>(`/StudyProjects/Delete/${id}`); }
  cancel(id: number, reason: string) { return this.api.put<StudyProject>(`/StudyProjects/Cancel/${id}`, { reason: reason.trim() }); }
  /** كل المراحل مغلقة: يُرسل الإنجاز لتوقيع إدارة المشاريع ثم رئيس الفرع */
  requestCompletion(id: number) { return this.api.put<StudyProject>(`/StudyProjects/RequestCompletion/${id}`, {}); }
  activityLog(id: number) { return this.api.get<StudyActivityLog[]>(`/StudyProjects/ActivityLog/${id}`); }

  // ─────────── الفريق ───────────
  addDepartment(projectId: number, departmentId: number) {
    return this.api.post<StudyProject>(`/StudyProjects/Departments/${projectId}`, { departmentId });
  }
  removeDepartment(projectDepartmentId: number) {
    return this.api.delete<StudyProject>(`/StudyProjects/Departments/${projectDepartmentId}`);
  }
  addMember(projectDepartmentId: number, userId: number, roleTitle?: string | null) {
    return this.api.post<StudyProject>(`/StudyProjects/Members/${projectDepartmentId}`, { userId, roleTitle: roleTitle?.trim() || null });
  }
  removeMember(projectDepartmentId: number, userId: number) {
    return this.api.delete<StudyProject>(`/StudyProjects/Members/${projectDepartmentId}/${userId}`);
  }

  // ─────────── المراحل ───────────
  stages(projectId: number) { return this.api.get<ProjectStage[]>(`/StudyStages/ByProject/${projectId}`); }
  createStage(body: StudyStageInput) { return this.api.post<ProjectStage>('/StudyStages/Create', body); }
  updateStage(id: number, body: StudyStageInput) { return this.api.put<ProjectStage>(`/StudyStages/Update/${id}`, body); }
  removeStage(id: number) { return this.api.delete<{ message: string }>(`/StudyStages/Delete/${id}`); }
  /** ترتيب جديد: كل مراحل المشروع بالترتيب المطلوب */
  reorderStages(projectId: number, stageIds: number[]) {
    return this.api.put<ProjectStage[]>(`/StudyStages/Reorder/${projectId}`, { stageIds });
  }
  closeStage(id: number) { return this.api.put<ProjectStage>(`/StudyStages/Close/${id}`, {}); }
  reopenStage(id: number) { return this.api.put<ProjectStage>(`/StudyStages/Reopen/${id}`, {}); }

  // ─────────── المهام ───────────
  tasks(stageId: number) { return this.api.get<StageTask[]>(`/StudyTasks/ByStage/${stageId}`); }
  /** كل مهام المشروع في طلب واحد (لمخطط Gantt): بترتيب المرحلة ثم البدء المخطط، والأعلام كما في ByStage */
  projectTasks(projectId: number) { return this.api.get<StageTask[]>(`/StudyTasks/ByProject/${projectId}`); }
  task(id: number) { return this.api.get<StageTask>(`/StudyTasks/Get/${id}`); }
  /** مهامي: المسندة إليّ أو إلى مكتبي أو قسمي */
  myTasks(openOnly = true, page = 1, pageSize = 20) {
    return this.api.get<PagedResult<StageTask>>('/StudyTasks/My' + query({ openOnly, page, pageSize }));
  }
  createTask(body: StageTaskInput) { return this.api.post<StageTask>('/StudyTasks/Create', body); }
  updateTask(id: number, body: StageTaskInput) { return this.api.put<StageTask>(`/StudyTasks/Update/${id}`, body); }
  removeTask(id: number) { return this.api.delete<{ message: string }>(`/StudyTasks/Delete/${id}`); }
  updateProgress(id: number, body: StageTaskProgressInput) { return this.api.put<StageTask>(`/StudyTasks/Progress/${id}`, body); }
}
