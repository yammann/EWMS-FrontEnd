import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import {
  BranchDashboard, DepartmentDashboard, EmployeeDashboard, OfficeDashboard, OverviewDashboard, VacationStats
} from '../models/dashboard.models';

/** بدون id → نطاق المستخدم نفسه (الباكاند يتحقق من الصلاحية) */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  overview() { return this.api.get<OverviewDashboard>('/Dashboard/Overview'); }
  branch(id?: number | null) { return this.api.get<BranchDashboard>(`/Dashboard/Branch${id ? '/' + id : ''}`); }
  department(id?: number | null) { return this.api.get<DepartmentDashboard>(`/Dashboard/Department${id ? '/' + id : ''}`); }
  office(id?: number | null) { return this.api.get<OfficeDashboard>(`/Dashboard/Office${id ? '/' + id : ''}`); }
  me() { return this.api.get<EmployeeDashboard>('/Dashboard/Me'); }

  /** إحصائيات الإجازات: نطاق الرئيس تلقائياً؛ SuperAdmin يختار فرعاً أو كل المؤسسة */
  vacations(branchId?: number | null) {
    return this.api.get<VacationStats>(`/Dashboard/Vacations${branchId ? '?branchId=' + branchId : ''}`);
  }
}
