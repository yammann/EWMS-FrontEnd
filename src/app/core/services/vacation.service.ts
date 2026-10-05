import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { PublicHoliday, Vacation, VacationApprovalContext, VacationDaysPreview, VacationPrint, VacationType } from '../models/vacation.models';

@Injectable({ providedIn: 'root' })
export class VacationService {
  private api = inject(ApiService);
  mine() { return this.api.get<Vacation[]>('/Vacations/My'); }
  pending() { return this.api.get<Vacation[]>('/Vacations/PendingForMe'); }
  // حسب الدور: SuperAdmin الكل، BranchManager فرعه، Manager قسمه، غيرهم إجازاته فقط
  all() { return this.api.get<Vacation[]>('/Vacations/GetAll'); }
  getById(id: number) { return this.api.get<Vacation>(`/Vacations/Get/${id}`); }
  /** «سجل الموظف» قبل القرار — لمن يستطيع اتخاذ القرار على هذا الطلب */
  approvalContext(id: number) { return this.api.get<VacationApprovalContext>(`/Vacations/ApprovalContext/${id}`); }
  /** محتوى مرفق (للمعاينة/التنزيل) — لمن يرى الإجازة */
  attachmentBlob(id: number) { return this.api.getBlob(`/Vacations/Attachment/${id}`); }
  printData(id: number) { return this.api.get<VacationPrint>(`/Vacations/Print/${id}`); }
  types() { return this.api.get<VacationType[]>('/VacationTypes/GetAll'); }
  /** أيام العمل في مدة (بلا جمعة ولا عطل رسمية) قبل التقديم */
  previewDays(start: string, end: string) {
    return this.api.get<VacationDaysPreview>(`/Vacations/PreviewDays?start=${start}&end=${end}`);
  }
  // يرجع الباكاند قائمة بعنصر واحد (شكل قديم بقي للتوافق؛ الدفع يُحدَّد عند الاعتماد النهائي)
  create(value: { vacationTypeId: number; vacReason: string; startVac: string; endVac: string }, attachments: File[] = []) {
    const body = new FormData();
    body.append('VacationTypeId', String(value.vacationTypeId));
    body.append('VacReason', value.vacReason.trim());
    body.append('StartVac', value.startVac);
    body.append('EndVac', value.endVac);
    for (const file of attachments) body.append('attachments', file, file.name);
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

  // العطل الرسمية — endDate اختياري لإضافة عدة أيام دفعة واحدة
  holidays(year?: number) { return this.api.get<PublicHoliday[]>('/PublicHolidays/GetAll' + (year ? `?year=${year}` : '')); }
  createHoliday(value: { date: string; endDate: string | null; name: string }) {
    return this.api.post<PublicHoliday[]>('/PublicHolidays/Create', value);
  }
  updateHoliday(id: number, value: { date: string; name: string }) {
    return this.api.put<PublicHoliday>(`/PublicHolidays/Update/${id}`, value);
  }
  deleteHoliday(id: number) { return this.api.delete(`/PublicHolidays/Delete/${id}`); }
}
