import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, last, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  AssignedTaskCard, AssignedTaskDetail, CreateTaskRequest, TaskBoard, TaskBoardMode, TaskStatus,
  TaskTargetKind, TaskTargetOption, TASK_STATUS_VALUE, UpdateTaskRequest
} from '../models/assigned-task.models';

@Injectable({ providedIn: 'root' })
export class AssignedTaskService {
  private api = inject(ApiService);

  board(mode: TaskBoardMode) { return this.api.get<TaskBoard>(`/AssignedTasks/Board?mode=${mode}`); }
  get(id: number) { return this.api.get<AssignedTaskDetail>(`/AssignedTasks/Get/${id}`); }
  /** جهات الإسناد من نوع معيّن، أو جهات التفويض من مهمة واردة (parentTaskId) */
  targets(options: { type?: TaskTargetKind; parentTaskId?: number } = {}) {
    const query = options.parentTaskId ? `?parentTaskId=${options.parentTaskId}` : options.type ? `?type=${options.type}` : '';
    return this.api.get<TaskTargetOption[]>(`/AssignedTasks/Targets${query}`);
  }

  create(body: CreateTaskRequest) { return this.api.post<AssignedTaskDetail>('/AssignedTasks/Create', body); }
  update(id: number, body: UpdateTaskRequest) { return this.api.put<AssignedTaskDetail>(`/AssignedTasks/Update/${id}`, body); }
  /** note: سبب إعادة المهمة من المراجعة إلى التنفيذ (من المُسنِد) */
  changeStatus(id: number, status: TaskStatus, note?: string | null) {
    return this.api.put<AssignedTaskCard>(`/AssignedTasks/Status/${id}`, { status: TASK_STATUS_VALUE[status], note: note ?? null });
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

  // ─────────── قائمة التحقق و«أتولّى» ───────────
  addChecklistItem(id: number, text: string) { return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Checklist/${id}`, { text }); }
  updateChecklistItem(itemId: number, change: { isDone?: boolean; text?: string }) {
    return this.api.put<AssignedTaskDetail>(`/AssignedTasks/ChecklistItem/${itemId}`, change);
  }
  deleteChecklistItem(itemId: number) { return this.api.delete<AssignedTaskDetail>(`/AssignedTasks/ChecklistItem/${itemId}`); }
  claim(id: number, claim: boolean) { return this.api.put<AssignedTaskDetail>(`/AssignedTasks/Claim/${id}`, { claim }); }
}
