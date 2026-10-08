import { Pagination } from '@core/utils/pagination';
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
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { PageActions } from '@shared/ui/page-actions';

type ModalType = 'create' | 'edit';

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './departments-page.html',
  styleUrl: './departments-page.scss'
})
export class DepartmentsPage {
  private departmentService = inject(DepartmentService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  departments = signal<Department[]>([]);
  pager = new Pagination(() => this.departments());
  branches = signal<Branch[]>([]);
  selectedDepartment = signal<Department | null>(null);
  activeModal = signal<ModalType | null>(null);
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
   * Modal control
   * ===================================================== */
  openCreate() {
    if (!this.canCreate()) {
      this.toast.show('لا تملك صلاحية إدارة الأقسام', 'error');
      return;
    }

    this.selectedDepartment.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
  }

  openEdit(department: Department) {
    if (!this.canEdit()) {
      this.toast.show('لا تملك صلاحية إدارة الأقسام', 'error');
      return;
    }

    this.selectedDepartment.set(department);
    this.editForm.patchValue({
      name: department.name,
      description: department.description,
      branchId: String(department.branchId)
    });
    this.activeModal.set('edit');
  }

  closeModal() {
    this.activeModal.set(null);
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء قسم جديد' : 'تعديل القسم';
  }

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.createForm.value.name ?? '');
    form.append('Description', this.createForm.value.description ?? '');
    form.append('BranchId', this.createForm.value.branchId ?? '');

    this.actions.run(
      'create',
      this.departmentService.create(form),
      'تم إنشاء القسم بنجاح',
      () => {
        this.createForm.reset();
        this.closeModal();
      }
    );
  }

  update() {
    const department = this.selectedDepartment();
    if (!department || this.editForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.editForm.value.name ?? '');
    form.append('Description', this.editForm.value.description ?? '');
    form.append('BranchId', this.editForm.value.branchId ?? '');

    this.actions.run(
      'edit',
      this.departmentService.update(department.id, form),
      'تم تعديل القسم بنجاح',
      () => this.closeModal()
    );
  }

  deleteDepartment(department: Department) {
    if (!this.canDelete()) {
      this.toast.show('لا تملك صلاحية حذف الأقسام', 'error');
      return;
    }

    this.confirm.ask(
      `هل أنت متأكد من حذف القسم "${department.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف'
    ).then(confirmed => { if (confirmed) this.performDelete(department); });
  }

  private performDelete(department: Department) {
    this.actions.run(
      `delete-${department.id}`,
      this.departmentService.delete(department.id),
      'تم حذف القسم بنجاح',
      () => {
        if (this.selectedDepartment()?.id === department.id) {
          this.selectedDepartment.set(null);
        }
      }
    );
  }

  /* =====================================================
   * Helpers
   * ===================================================== */
  branchName(branchId: number): string {
    return this.branches().find(b => b.id === branchId)?.name ?? 'غير محدد';
  }
}
