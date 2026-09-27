import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch } from '../../core/models/ewms.models';
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
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  branches = signal<Branch[]>([]);
  selectedBranch = signal<Branch | null>(null);
  activeModal = signal<ModalType | null>(null);
  toasts = signal<Toast[]>([]);
  confirmDialog = signal<ConfirmState | null>(null);
  loading = signal(true);
  saving = signal<string | null>(null);

  private toastSeq = 0;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  canManage = computed(() => this.auth.hasPermission('ManageBranches'));

  stats = computed(() => {
    const branches = this.branches();

    return {
      total: branches.length,
      withDescription: branches.filter(b => !!b.description).length,
      withoutDescription: branches.filter(b => !b.description).length
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
    this.ewms.getBranches().subscribe({
      next: branches => {
        this.branches.set(branches);
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
      this.showToast('لا تملك صلاحية إدارة الفروع', 'error');
      return;
    }

    this.selectedBranch.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
  }

  openEdit(branch: Branch) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية إدارة الفروع', 'error');
      return;
    }

    this.selectedBranch.set(branch);
    this.editForm.patchValue({
      name: branch.name,
      description: branch.description
    });
    this.activeModal.set('edit');
  }

  closeModal() {
    this.activeModal.set(null);
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء فرع جديد' : 'تعديل الفرع';
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

    this.save(
      'create',
      this.ewms.createBranch(form),
      'تم إنشاء الفرع بنجاح',
      () => {
        this.createForm.reset();
        this.closeModal();
      }
    );
  }

  update() {
    const branch = this.selectedBranch();
    if (!branch || this.editForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.editForm.value.name ?? '');
    form.append('Description', this.editForm.value.description ?? '');

    this.save(
      'edit',
      this.ewms.updateBranch(branch.id, form),
      'تم تعديل الفرع بنجاح',
      () => this.closeModal()
    );
  }

  deleteBranch(branch: Branch) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية حذف الفروع', 'error');
      return;
    }

    this.askConfirm(
      `هل أنت متأكد من حذف الفرع "${branch.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف',
      () => this.performDelete(branch)
    );
  }

  private performDelete(branch: Branch) {
    this.save(
      `delete-${branch.id}`,
      this.ewms.deleteBranch(branch.id),
      'تم حذف الفرع بنجاح',
      () => {
        if (this.selectedBranch()?.id === branch.id) {
          this.selectedBranch.set(null);
        }
      }
    );
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