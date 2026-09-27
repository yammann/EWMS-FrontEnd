import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Branch, Department, Office, Role, User } from '../models/ewms.models';

@Injectable({ providedIn: 'root' })
export class EwmsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  getOffices() { return this.api.get<Office[]>('/Offices/GetAll'); }
  createOffice(body: FormData) { return this.api.post<Office>('/Offices/Create', body); }
  updateOffice(id: number, body: FormData) { return this.api.put<Office>(`/Offices/Update/${id}`, body); }
  deleteOffice(id: number) { return this.api.delete(`/Offices/Delete/${id}`); }

  getDepartments() {
    return this.api.get<Department[]>('/Department/GetAll');
  }

  createDepartment(form: FormData) {
    return this.api.post<Department>('/Department/Create', form);
  }

  updateDepartment(id: number, form: FormData) {
    return this.api.put<Department>(`/Department/Update/${id}`, form);
  }

  deleteDepartment(id: number) {
    return this.api.delete<{ message: string }>(`/Department/Delete/${id}`);
  }

  getBranches() {
    return this.api.get<Branch[]>('/Branches/GetAll');
  }

  // قائمة فروع للقوائم المنسدلة: Branches/GetAll يتطلب ManageBranches (غير متاحة لرؤساء الأقسام/الفروع)،
  // لذلك نستخرج الفروع من الأقسام (Department/GetAll متاح لأي مستخدم مسجّل)
  getBranchLookup() {
    if (this.auth.hasPermission('ManageBranches')) return this.getBranches();
    return this.getDepartments().pipe(map(departments => {
      const branches = new Map<number, Branch>();
      for (const d of departments) {
        if (!branches.has(d.branchId)) branches.set(d.branchId, { id: d.branchId, name: d.branchName, description: '' });
      }
      return [...branches.values()];
    }));
  }

  createBranch(form: FormData) {
    return this.api.post<Branch>('/Branches/Create', form);
  }

  updateBranch(id: number, form: FormData) {
    return this.api.put<Branch>(`/Branches/Update/${id}`, form);
  }

  deleteBranch(id: number) {
    return this.api.delete<{ message: string }>(`/Branches/Delete/${id}`);
  }

  getUsers() {
    return this.api.get<User[]>('/Users/GetAll');
  }

  createUser(form: FormData) {
    return this.api.post<User>('/Users/Create', form);
  }

  updateUser(id: number, form: FormData) {
    return this.api.put<User>(`/Users/Update/${id}`, form);
  }

  deleteUser(id: number) {
    return this.api.delete<{ message: string }>(`/Users/Delete/${id}`);
  }

  getRoles() {
    return this.api.get<Role[]>('/Roles/GetAll');
  }

  createRole(form: FormData) {
    return this.api.post<Role>('/Roles/Create', form);
  }

  updateRole(id: number, form: FormData) {
    return this.api.put<Role>(`/Roles/Update/${id}`, form);
  }

  deleteRole(id: number) {
    return this.api.delete<{ message: string }>(`/Roles/Delete/${id}`);
  }

  getPermissions() {
    return this.api.get<Role['permissions']>('/Roles/Permissions');
  }
}
