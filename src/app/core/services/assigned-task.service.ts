import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import {
  AssignedTaskCard, AssignedTaskDetail, CreateTaskRequest, TaskBoard, TaskBoardMode, TaskStatus,
  TaskTargetOption, TASK_STATUS_VALUE, UpdateTaskRequest
} from '../models/assigned-task.models';

@Injectable({ providedIn: 'root' })
export class AssignedTaskService {
  private api = inject(ApiService);

  board(mode: TaskBoardMode) { return this.api.get<TaskBoard>(`/AssignedTasks/Board?mode=${mode}`); }
  get(id: number) { return this.api.get<AssignedTaskDetail>(`/AssignedTasks/Get/${id}`); }
  targets() { return this.api.get<TaskTargetOption[]>('/AssignedTasks/Targets'); }

  create(body: CreateTaskRequest) { return this.api.post<AssignedTaskDetail>('/AssignedTasks/Create', body); }
  update(id: number, body: UpdateTaskRequest) { return this.api.put<AssignedTaskDetail>(`/AssignedTasks/Update/${id}`, body); }
  changeStatus(id: number, status: TaskStatus) {
    return this.api.put<AssignedTaskCard>(`/AssignedTasks/Status/${id}`, { status: TASK_STATUS_VALUE[status] });
  }
  comment(id: number, text: string) { return this.api.post<AssignedTaskDetail>(`/AssignedTasks/Comment/${id}`, { text }); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/AssignedTasks/Delete/${id}`); }
}
