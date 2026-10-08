import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { WorkTask, WorkTaskCard, WorkTaskRequest } from './work-task.models';

@Injectable({ providedIn: 'root' })
export class WorkTaskService {
  private api = inject(ApiService);

  // للموظف والرؤساء
  my() { return this.api.get<WorkTaskCard[]>('/WorkTasks/My'); }
  view(id: number) { return this.api.get<WorkTaskCard>(`/WorkTasks/View/${id}`); }

  // للإدارة (ManageWorkTasks)
  getAll(branchId?: number | null) {
    return this.api.get<WorkTask[]>(`/WorkTasks/GetAll${branchId ? '?branchId=' + branchId : ''}`);
  }
  create(body: WorkTaskRequest) { return this.api.post<WorkTask>('/WorkTasks/Create', body); }
  update(id: number, body: WorkTaskRequest) { return this.api.put<WorkTask>(`/WorkTasks/Update/${id}`, body); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/WorkTasks/Delete/${id}`); }
}
