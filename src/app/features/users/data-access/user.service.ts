import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { User } from '@core/models/ewms.models';

/** المستخدمون (لا تُخزَّن مؤقتاً: تتغير كثيراً وتُقرأ بصلاحيات ونطاق مختلف) */
@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  getAll() { return this.api.get<User[]>('/Users/GetAll'); }
  getByBranch(branchId: number) { return this.api.get<User[]>(`/Users/Branch/${branchId}`); }
  create(form: FormData) { return this.api.post<User>('/Users/Create', form); }
  update(id: number, form: FormData) { return this.api.put<User>(`/Users/Update/${id}`, form); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/Users/Delete/${id}`); }
}
