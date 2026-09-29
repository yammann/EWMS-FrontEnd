import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PageActions } from '../../shared/ui/page-actions';

type ModalType = 'create' | 'edit';

@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  branches = signal<Branch[]>([]);
  selectedBranch = signal<Branch | null>(null);
  activeModal = signal<ModalType | null>(null);
  loading = signal(true);
  private actions = new PageActions(() => this.load());
  saving = this.actions.saving;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  canManage = computed(() => this.auth.hasPermission(AppPermission.ManageBranches));

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
      error: error => { this.loading.set(false); this.actions.loadFailed(error); }
    });
  }

  /* =====================================================
   * Modal control
   * ===================================================== */
  openCreate() {
    if (!this.canManage()) {
      this.toast.show('لا تملك صلاحية إدارة الفروع', 'error');
      return;
    }

    this.selectedBranch.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
  }

  openEdit(branch: Branch) {
    if (!this.canManage()) {
      this.toast.show('لا تملك صلاحية إدارة الفروع', 'error');
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

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.createForm.value.name ?? '');
    form.append('Description', this.createForm.value.description ?? '');

    this.actions.run(
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

    this.actions.run(
      'edit',
      this.ewms.updateBranch(branch.id, form),
      'تم تعديل الفرع بنجاح',
      () => this.closeModal()
    );
  }

  deleteBranch(branch: Branch) {
    if (!this.canManage()) {
      this.toast.show('لا تملك صلاحية حذف الفروع', 'error');
      return;
    }

    this.confirm.ask(
      `هل أنت متأكد من حذف الفرع "${branch.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف'
    ).then(confirmed => { if (confirmed) this.performDelete(branch); });
  }

  private performDelete(branch: Branch) {
    this.actions.run(
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
}
