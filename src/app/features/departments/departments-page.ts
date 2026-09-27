import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Branch, Department } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';

type ModalType = 'create' | 'edit';
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmState {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './departments-page.html',
  styleUrl: './departments-page.scss'
})
export class DepartmentsPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  departments = signal<Department[]>([]);
  branches = signal<Branch[]>([]);
  selectedDepartment = signal<Department | null>(null);
  activeModal = signal<ModalType | null>(null);
  toasts = signal<Toast[]>([]);
  confirmDialog = signal<ConfirmState | null>(null);
  loading = signal(true);
  saving = signal<string | null>(null);

  private toastSeq = 0;

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

  canManage = computed(() => this.auth.hasPermission('ManageDepartments'));

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

  constructor() {
    this.load();
  }

  /* =====================================================
   * Data loading
   * ===================================================== */
  load() {
    this.loading.set(true);
    forkJoin({
      departments: this.ewms.getDepartments(),
      branches: this.ewms.getBranchLookup()
    }).subscribe({
      next: result => {
        this.departments.set(result.departments);
        this.branches.set(result.branches);
        this.loading.set(false);
      },
      error: error => this.fail(error)
    });
  }

  /* =====================================================
   * Toast system
   * ===================================================== */
  showToast(message: string, type: ToastType = 'success') {
    const id = ++this.toastSeq;
    this.toasts.update(list => [...list, { id, type, message }]);

    const duration = type === 'error' ? 6000 : 4000;
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  /* =====================================================
   * Confirm dialog
   * ===================================================== */
  askConfirm(message: string, confirmLabel: string, onConfirm: () => void) {
    this.confirmDialog.set({ message, confirmLabel, onConfirm });
  }

  confirmYes() {
    const dialog = this.confirmDialog();
    if (!dialog) return;
    this.confirmDialog.set(null);
    dialog.onConfirm();
  }

  confirmNo() {
    this.confirmDialog.set(null);
  }

  /* =====================================================
   * Modal control
   * ===================================================== */
  openCreate() {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية إدارة الأقسام', 'error');
      return;
    }

    this.selectedDepartment.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
  }

  openEdit(department: Department) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية إدارة الأقسام', 'error');
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

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirmDialog()) {
      this.confirmNo();
      return;
    }
    if (this.activeModal()) {
      this.closeModal();
    }
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

    this.save(
      'create',
      this.ewms.createDepartment(form),
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

    this.save(
      'edit',
      this.ewms.updateDepartment(department.id, form),
      'تم تعديل القسم بنجاح',
      () => this.closeModal()
    );
  }

  deleteDepartment(department: Department) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية حذف الأقسام', 'error');
      return;
    }

    this.askConfirm(
      `هل أنت متأكد من حذف القسم "${department.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف',
      () => this.performDelete(department)
    );
  }

  private performDelete(department: Department) {
    this.save(
      `delete-${department.id}`,
      this.ewms.deleteDepartment(department.id),
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

  /* =====================================================
   * Private helpers
   * ===================================================== */
  private save(
    key: string,
    request: import('rxjs').Observable<unknown>,
    message: string,
    after?: () => void
  ) {
    this.saving.set(key);

    request.subscribe({
      next: () => {
        this.saving.set(null);
        this.showToast(message, 'success');
        after?.();
        this.load();
      },
      error: error => {
        this.saving.set(null);
        this.showToast(
          error?.error?.message || error?.message || 'تعذر تنفيذ العملية',
          'error'
        );
      }
    });
  }

  private fail(error: { message?: string; error?: { message?: string } }) {
    this.showToast(
      error?.error?.message || error?.message || 'تعذر تحميل البيانات',
      'error'
    );
    this.loading.set(false);
    this.saving.set(null);
  }
}