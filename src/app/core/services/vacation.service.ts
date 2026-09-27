import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Vacation, VacationType } from '../models/vacation.models';

@Injectable({ providedIn: 'root' })
export class VacationService {
  private api = inject(ApiService);
  mine() { return this.api.get<Vacation[]>('/Vacations/My'); }
  pending() { return this.api.get<Vacation[]>('/Vacations/PendingForMe'); }
  // حسب الدور: SuperAdmin الكل، BranchManager فرعه، Manager قسمه، غيرهم إجازاته فقط
  all() { return this.api.get<Vacation[]>('/Vacations/GetAll'); }
  getById(id: number) { return this.api.get<Vacation>(`/Vacations/Get/${id}`); }
  types() { return this.api.get<VacationType[]>('/VacationTypes/GetAll'); }
  // قد يُقسَم الطلب إلى أكثر من إجازة (مدفوعة + غير مدفوعة) لذلك يرجع الباكاند قائمة
  create(value: { vacationTypeId: number; vacReason: string; startVac: string; endVac: string }) {
    const body = new FormData();
    body.append('VacationTypeId', String(value.vacationTypeId));
    body.append('VacReason', value.vacReason.trim());
    body.append('StartVac', value.startVac);
    body.append('EndVac', value.endVac);
    return this.api.post<Vacation[]>('/Vacations/Create', body);
  }
  cancel(id: number) {
    return this.api.put<{ message: string }>(`/Vacations/Cancel/${id}`, {});
  }
  approve(id: number, approve: boolean, reason: string) {
    return this.api.put<{ message: string }>(`/Vacations/Approve/${id}`, { approve, reason });
  }
  createType(value: { name: string; description: string; isPaid: boolean }) {
    return this.api.post<VacationType>('/VacationTypes/Create', value);
  }
  updateType(id: number, value: { name: string; description: string; isPaid: boolean }) {
    return this.api.put<VacationType>(`/VacationTypes/Update/${id}`, value);
  }
  deleteType(id: number) { return this.api.delete(`/VacationTypes/Delete/${id}`); }
}
