import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, last, tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import {
  AssignedTaskCard, AssignedTaskDetail, CreateTaskRequest, SaveRecurrenceRequest, SaveTemplateRequest, TaskBoard, TaskBoardMode,
  TaskExportFilter, TaskLink, TaskLinkType, TaskRecurrence, TaskStats, TaskStatus, TaskTargetKind, TaskTargetOption, TaskTemplate,
  TASK_STATUS_VALUE, UpdateTaskRequest
} from './assigned-task.models';

@Injectable({ providedIn: 'root' })
export class AssignedTaskService {
  private api = inject(ApiService);

  /** doneDays: عمر المنجزة المعروضة (الافتراضي 30 يوماً) */
  board(mode: TaskBoardMode, doneDays?: number) {
    return this.api.get<TaskBoard>(`/AssignedTasks/Board?mode=${mode}${doneDays ? `&doneDays=${doneDays}` : ''}`);
  }
  get(id: number) { return this.api.get<AssignedTaskDetail>(`/AssignedTasks/Get/${id}`); }
  /** جهات الإسناد من نوع معيّن، أو جهات التفويض من مهمة واردة (parentTaskId) */
  targets(options: { type?: TaskTargetKind; parentTaskId?: number } = {}) {
    const query = options.parentTaskId ? `?parentTaskId=${options.parentTaskId}` : options.type ? `?type=${options.type}` : '';
    return this.api.get<TaskTargetOption[]>(`/AssignedTasks/Targets${query}`);
  }

  create(body: CreateTaskRequest) { return this.api.post<AssignedTaskDetail>('/AssignedTasks/Create', body); }
  update(id: number, body: UpdateTaskRequest) { return this.api.put<AssignedTaskDetail>(`/AssignedTasks/Update/${id}`, body); }
  /** note: سبب إعادة المهمة من المراجعة إلى التنفيذ (من المُسنِد) */
  /** expected = الحالة التي رآها المستخدم حين قرّر: إن تغيّرت على الخادم منذها يُرفض القرار (لا يكتب فوق قرار غيره) */
  changeStatus(id: number, status: TaskStatus, note?: string | null, expected?: TaskStatus) {
    return this.api.put<AssignedTaskCard>(`/AssignedTasks/Status/${id}`, {
      status: TASK_STATUS_VALUE[status], note: note ?? null, expectedStatus: expected ? TASK_STATUS_VALUE[expected] : null
    });
  }
  comment(id: number, text: string) { return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Comment/${id}`, { text }); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/AssignedTasks/Delete/${id}`); }

  // ─────────── المرفقات ───────────
  attach(id: number, files: File[]) {
    const body = new FormData();
    for (const file of files) body.append('files', file, file.name);
    return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Attachments/${id}`, body);
  }

  /**
   * يرفع الملفات واحداً بعد الآخر (كل طلب ≤ 10MB): يتوقف عند أول فشل، ويُبلَّغ التقدّم بعد كل ملف.
   * يُنهي بتفصيل المهمة الأخير.
   */
  attachSequentially(id: number, files: File[], onProgress?: (done: number, total: number) => void): Observable<AssignedTaskDetail> {
    let done = 0;
    return from(files).pipe(
      concatMap(file => this.attach(id, [file]).pipe(tap(() => onProgress?.(++done, files.length)))),
      last()
    );
  }

  attachmentBlob(id: number) { return this.api.getBlob(`/AssignedTasks/Attachment/${id}`); }
  deleteAttachment(id: number) { return this.api.delete<AssignedTaskDetail>(`/AssignedTasks/Attachment/${id}`); }

  // ─────────── التصدير ───────────
  exportExcel(filter: TaskExportFilter) {
    const p = new URLSearchParams({ mode: filter.mode });
    if (filter.doneDays) p.set('doneDays', String(filter.doneDays));
    if (filter.q) p.set('q', filter.q);
    if (filter.priority) p.set('priority', filter.priority);
    if (filter.overdueOnly) p.set('overdueOnly', 'true');
    if (filter.dueFrom) p.set('dueFrom', filter.dueFrom);
    if (filter.dueTo) p.set('dueTo', filter.dueTo);
    return this.api.getBlob(`/AssignedTasks/Export?${p}`);
  }

  // ─────────── القوالب والمهام الدورية ───────────
  templates() { return this.api.get<TaskTemplate[]>('/AssignedTasks/Templates'); }
  createTemplate(body: SaveTemplateRequest) { return this.api.post<TaskTemplate>('/AssignedTasks/Templates', body); }
  updateTemplate(id: number, body: SaveTemplateRequest) { return this.api.put<TaskTemplate>(`/AssignedTasks/Templates/${id}`, body); }
  deleteTemplate(id: number) { return this.api.delete<{ message: string }>(`/AssignedTasks/Templates/${id}`); }

  recurrences() { return this.api.get<TaskRecurrence[]>('/AssignedTasks/Recurrences'); }
  createRecurrence(body: SaveRecurrenceRequest) { return this.api.post<TaskRecurrence>('/AssignedTasks/Recurrences', body); }
  updateRecurrence(id: number, body: SaveRecurrenceRequest) { return this.api.put<TaskRecurrence>(`/AssignedTasks/Recurrences/${id}`, body); }
  setRecurrenceActive(id: number, isActive: boolean) { return this.api.put<TaskRecurrence>(`/AssignedTasks/Recurrences/${id}/Active`, { isActive }); }
  runRecurrenceNow(id: number) { return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Recurrences/${id}/RunNow`, {}); }
  deleteRecurrence(id: number) { return this.api.delete<{ message: string }>(`/AssignedTasks/Recurrences/${id}`); }

  // ─────────── الروابط بالسجلات ───────────
  links(taskId: number) { return this.api.get<TaskLink[]>(`/AssignedTasks/Links/${taskId}`); }
  addLink(taskId: number, entityType: TaskLinkType, reference: string | null, entityId: number | null = null) {
    return this.api.post<TaskLink[]>(`/AssignedTasks/Links/${taskId}`, { entityType, reference, entityId });
  }
  removeLink(linkId: number) { return this.api.delete<TaskLink[]>(`/AssignedTasks/Link/${linkId}`); }
  byLink(entityType: TaskLinkType, entityId: number) {
    return this.api.get<AssignedTaskCard[]>(`/AssignedTasks/ByLink?entityType=${entityType}&entityId=${entityId}`);
  }

  // ─────────── الإحصائيات ───────────
  stats(from?: string, to?: string) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return this.api.get<TaskStats>(`/AssignedTasks/Stats?${p}`);
  }

  // ─────────── قائمة التحقق و«أتولّى» ───────────
  addChecklistItem(id: number, text: string) { return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Checklist/${id}`, { text }); }
  updateChecklistItem(itemId: number, change: { isDone?: boolean; text?: string }) {
    return this.api.put<AssignedTaskDetail>(`/AssignedTasks/ChecklistItem/${itemId}`, change);
  }
  deleteChecklistItem(itemId: number) { return this.api.delete<AssignedTaskDetail>(`/AssignedTasks/ChecklistItem/${itemId}`); }
  claim(id: number, claim: boolean) { return this.api.put<AssignedTaskDetail>(`/AssignedTasks/Claim/${id}`, { claim }); }
}
