import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { LookupsService } from '@core/services/lookups.service';
import { Branch } from '@core/models/ewms.models';

/** الفروع — القراءة المخزّنة من LookupsService، والتعديلات تُبطل التخزين */
@Injectable({ providedIn: 'root' })
export class BranchService {
  private api = inject(ApiService);
  private lookups = inject(LookupsService);

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث») */
  getAll(force = false) { return this.lookups.branches(force); }
  create(form: FormData) { return this.api.post<Branch>('/Branches/Create', form).pipe(tap(() => this.lookups.invalidate())); }
  update(id: number, form: FormData) { return this.api.put<Branch>(`/Branches/Update/${id}`, form).pipe(tap(() => this.lookups.invalidate())); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/Branches/Delete/${id}`).pipe(tap(() => this.lookups.invalidate())); }
}
