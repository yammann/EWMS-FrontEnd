import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { Branch, Department } from '@core/models/ewms.models';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { Pagination } from '@core/utils/pagination';
import { AdminHeader } from '@shared/ui/admin-header';
import { CrudMode, CrudPage } from '@shared/ui/crud-page';
import { EntityForm } from '@shared/ui/entity-form';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { StatTile } from '@shared/ui/stat-tile';
import { DepartmentService } from '../data-access/department.service';

/** الأقسام — النمط الموحّد لصفحات الإدارة (CrudPage) */
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
  private auth = inject(AuthService);

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateDepartment));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditDepartment));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteDepartment));

  branches = signal<Branch[]>([]);

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    branchId: ['', Validators.required]
  });

  crud = new CrudPage<Department, FormData>({
    // الأقسام + قائمة الفروع للنموذج (الفروع من التخزين المشترك إن كانت حديثة)
    load: () => forkJoin({ departments: this.departmentService.getAll(), branches: this.lookups.branchOptions() })
      .pipe(map(r => { this.branches.set(r.branches); return r.departments; })),
    create: body => this.departmentService.create(body),
    update: (id, body) => this.departmentService.update(id, body),
    remove: d => this.departmentService.delete(d.id),
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    onOpen: d => this.form.reset({ name: d?.name ?? '', description: d?.description ?? '', branchId: d ? String(d.branchId) : '' }),
    onRefresh: () => this.lookups.invalidate(),
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء القسم بنجاح' : 'تم تعديل القسم بنجاح',
      deleted: 'تم حذف القسم بنجاح', plural: 'الأقسام', confirmLabel: 'تأكيد الحذف',
      confirmDelete: d => `هل أنت متأكد من حذف القسم "${d.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
    }
  });

  departments = this.crud.items;
  pager = new Pagination(() => this.departments());

  stats = computed(() => {
    const departments = this.departments();
    return {
      total: departments.length,
      withDescription: departments.filter(d => !!d.description).length,
      branchesCovered: new Set(departments.map(d => d.branchId)).size,
      totalBranches: this.branches().length
    };
  });

  title(mode: CrudMode) { return mode === 'create' ? 'إنشاء قسم جديد' : 'تعديل القسم'; }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const f = new FormData();
    f.append('Name', v.name ?? ''); f.append('Description', v.description ?? ''); f.append('BranchId', v.branchId ?? '');
    this.crud.save(f);
  }

  branchName(branchId: number): string {
    return this.branches().find(b => b.id === branchId)?.name ?? 'غير محدد';
  }
}
