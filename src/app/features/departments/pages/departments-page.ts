import { Pagination } from '@core/utils/pagination';
import { EntityForm } from '@shared/ui/entity-form';
import { RowActions } from '@shared/ui/row-actions';
import { StatTile } from '@shared/ui/stat-tile';
import { AdminHeader } from '@shared/ui/admin-header';
import { loader } from '@shared/ui/loader';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Branch, Department } from '@core/models/ewms.models';
import { DepartmentService } from '../data-access/department.service';
import { LookupsService } from '@core/services/lookups.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';
import { PageActions } from '@shared/ui/page-actions';
import { ModalCrud } from '@shared/ui/modal-crud';

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [EntityForm, RowActions, StatTile, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './departments-page.html',
  styleUrl: './departments-page.scss'
})
export class DepartmentsPage {
  private departmentService = inject(DepartmentService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  departments = signal<Department[]>([]);
  pager = new Pagination(() => this.departments());
  branches = signal<Branch[]>([]);
  private actions = new PageActions(() => this.load(true));
  saving = this.actions.saving;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    branchId: ['', Validators.required]
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    branchId: ['', Validators.required]
  });

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateDepartment));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditDepartment));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteDepartment));

  crud = new ModalCrud({
    actions: this.actions, noun: 'القسم', plural: 'الأقسام',
    titles: { create: 'إنشاء قسم جديد', edit: 'تعديل القسم' },
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    forms: { create: this.createForm, edit: this.editForm },
    toEditValue: (d: Department) => ({ name: d.name, description: d.description, branchId: String(d.branchId) }),
    toBody: v => { const f = new FormData(); f.append('Name', v.name ?? ''); f.append('Description', v.description ?? ''); f.append('BranchId', v.branchId ?? ''); return f; },
    service: this.departmentService
  });

  stats = computed(() => {
    const departments = this.departments();
    const branches = this.branches();

    return {
      total: departments.length,
      withDescription: departments.filter(d => !!d.description).length,
      branchesCovered: new Set(departments.map(d => d.branchId)).size,
      totalBranches: branches.length
    };
  });


  /* =====================================================
   * Data loading
   * ===================================================== */
  private force = false;
  private data = loader(() => forkJoin({
    departments: this.departmentService.getAll(this.force),
    branches: this.lookups.branchOptions(this.force)
  }), null, {
    onLoaded: result => { if (result) { this.departments.set(result.departments); this.branches.set(result.branches); } },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }

  /* =====================================================
   * Helpers
   * ===================================================== */
  branchName(branchId: number): string {
    return this.branches().find(b => b.id === branchId)?.name ?? 'غير محدد';
  }
}
