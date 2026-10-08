import { Pagination } from '@core/utils/pagination';
import { loader } from '@shared/ui/loader';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { BranchService } from '../data-access/branch.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { PageActions } from '@shared/ui/page-actions';

type ModalType = 'create' | 'edit';

@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage {
  private branchService = inject(BranchService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  branches = signal<Branch[]>([]);
  pager = new Pagination(() => this.branches());
  selectedBranch = signal<Branch | null>(null);
  activeModal = signal<ModalType | null>(null);
  private actions = new PageActions(() => this.load(true));
  saving = this.actions.saving;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateBranch));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditBranch));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteBranch));

  stats = computed(() => {
    const branches = this.branches();

    return {
      total: branches.length,
      withDescription: branches.filter(b => !!b.description).length,
      withoutDescription: branches.filter(b => !b.description).length
    };
  });

  /* =====================================================
   * Data loading
   * ===================================================== */
  private force = false;
  private data = loader(() => this.branchService.getAll(this.force), [] as Branch[], {
    onLoaded: branches => this.branches.set(branches),
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
      this.toast.show('لا تملك صلاحية إدارة الفروع', 'error');
      return;
    }

    this.selectedBranch.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
  }

  openEdit(branch: Branch) {
    if (!this.canEdit()) {
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
      this.branchService.create(form),
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
      this.branchService.update(branch.id, form),
      'تم تعديل الفرع بنجاح',
      () => this.closeModal()
    );
  }

  deleteBranch(branch: Branch) {
    if (!this.canDelete()) {
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
      this.branchService.delete(branch.id),
      'تم حذف الفرع بنجاح',
      () => {
        if (this.selectedBranch()?.id === branch.id) {
          this.selectedBranch.set(null);
        }
      }
    );
  }
}
