import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName } from '@core/constants/access';
import {
  DecisionInput, DelayInput, ExtensionInput, ExtensionPreview, JustifyInput, ProgressEntry, ProgressInput, ScheduleDelay, ScheduleDependency,
  ScheduleDetail, ScheduleExtension, ScheduleOverview, ScheduleTask, StartOrder, StartOrderInput, TaskInput
} from './schedule.models';

/** الجدول الزمني والتأخير والتمديد (api/ProjectSchedules) — حدود المشروع والاعتماد يطبّقها الخادم */
@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي: تُظهر الأزرار فقط؛ الخادم يرفض ما يخالف الحد أو فصل الإعداد عن الاعتماد */
  access = computed(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    return {
      canRecordDelay: has(AppPermission.RecordScheduleDelay),
      canDecideDelay: has(AppPermission.ApproveDelayJustification),
      canRequestExtension: has(AppPermission.RequestScheduleExtension),
      canDecideExtension: has(AppPermission.ApproveScheduleExtension),
      /** المستندات الداعمة تُختار من وثائق المشروع */
      canListDocuments: has(AppPermission.ViewProjectDocuments)
    };
  });

  private base = '/ProjectSchedules';

  overview(projectId: number) { return this.api.get<ScheduleOverview>(`${this.base}/Overview/${projectId}`); }
  schedule(id: number) { return this.api.get<ScheduleDetail>(`${this.base}/Get/${id}`); }
  progressHistory(taskId: number) { return this.api.get<ProgressEntry[]>(`${this.base}/Progress/${taskId}`); }

  saveStartOrder(projectId: number, v: StartOrderInput) { return this.api.put<StartOrder>(`${this.base}/StartOrder/${projectId}`, v); }

  createDraft(projectId: number, title: string, note: string) { return this.api.post<ScheduleDetail>(`${this.base}/Draft/${projectId}`, { title, note }); }
  deleteDraft(id: number) { return this.api.delete<void>(`${this.base}/Draft/${id}`); }
  approve(id: number) { return this.api.post<ScheduleDetail>(`${this.base}/Approve/${id}`, {}); }

  addTask(scheduleId: number, v: TaskInput) { return this.api.post<ScheduleTask>(`${this.base}/Tasks/${scheduleId}`, v); }
  updateTask(taskId: number, v: TaskInput) { return this.api.put<ScheduleTask>(`${this.base}/Task/${taskId}`, v); }
  deleteTask(taskId: number) { return this.api.delete<void>(`${this.base}/Task/${taskId}`); }
  reorder(scheduleId: number, taskIds: number[]) { return this.api.put<void>(`${this.base}/Reorder/${scheduleId}`, { taskIds }); }
  addDependency(scheduleId: number, predecessorId: number, successorId: number) {
    return this.api.post<ScheduleDependency>(`${this.base}/Dependencies/${scheduleId}`, { predecessorId, successorId });
  }
  removeDependency(id: number) { return this.api.delete<void>(`${this.base}/Dependency/${id}`); }

  updateProgress(taskId: number, v: ProgressInput) { return this.api.put<ScheduleTask>(`${this.base}/Progress/${taskId}`, v); }
  classify(taskId: number, isCritical: boolean, rowVersion: string) {
    return this.api.put<ScheduleTask>(`${this.base}/Classify/${taskId}`, { isCritical, rowVersion });
  }

  // ─────────── التأخير ───────────
  delays(projectId: number) { return this.api.get<ScheduleDelay[]>(`${this.base}/Delays/${projectId}`); }
  delay(id: number) { return this.api.get<ScheduleDelay>(`${this.base}/Delay/${id}`); }
  recordDelay(taskId: number, v: DelayInput) { return this.api.post<ScheduleDelay>(`${this.base}/RecordDelay/${taskId}`, v); }
  justifyDelay(id: number, v: JustifyInput) { return this.api.put<ScheduleDelay>(`${this.base}/Delay/${id}/Justify`, v); }
  decideDelay(id: number, v: DecisionInput) { return this.api.put<ScheduleDelay>(`${this.base}/Delay/${id}/Decide`, v); }

  // ─────────── التمديد ───────────
  extensions(projectId: number) { return this.api.get<ScheduleExtension[]>(`${this.base}/Extensions/${projectId}`); }
  extension(id: number) { return this.api.get<ScheduleExtension>(`${this.base}/Extension/${id}`); }
  previewExtension(projectId: number, v: ExtensionInput) { return this.api.post<ExtensionPreview>(`${this.base}/Extensions/${projectId}/Preview`, v); }
  createExtension(projectId: number, v: ExtensionInput) { return this.api.post<ScheduleExtension>(`${this.base}/Extensions/${projectId}`, v); }
  updateExtension(id: number, v: ExtensionInput) { return this.api.put<ScheduleExtension>(`${this.base}/Extension/${id}`, v); }
  submitExtension(id: number) { return this.api.post<ScheduleExtension>(`${this.base}/Extension/${id}/Submit`, {}); }
  deleteExtension(id: number) { return this.api.delete<void>(`${this.base}/Extension/${id}`); }
  decideExtension(id: number, v: DecisionInput) { return this.api.put<ScheduleExtension>(`${this.base}/Extension/${id}/Decide`, v); }
}
