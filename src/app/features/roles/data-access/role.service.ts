import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { LookupsService } from '@core/services/lookups.service';
import { Role } from '@core/models/ewms.models';

/** الأدوار — القراءة المخزّنة من LookupsService، والتعديلات تُبطل التخزين */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private api = inject(ApiService);
  private lookups = inject(LookupsService);

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث») */
  getAll(force = false) { return this.lookups.roles(force); }
  create(form: FormData) { return this.api.post<Role>('/Roles/Create', form).pipe(tap(() => this.lookups.invalidate())); }
  update(id: number, form: FormData) { return this.api.put<Role>(`/Roles/Update/${id}`, form).pipe(tap(() => this.lookups.invalidate())); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/Roles/Delete/${id}`).pipe(tap(() => this.lookups.invalidate())); }
  getPermissions() { return this.api.get<Role['permissions']>('/Roles/Permissions'); }
}
