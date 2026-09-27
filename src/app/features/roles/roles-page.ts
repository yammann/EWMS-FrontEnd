import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Permission, Role } from '../../core/models/ewms.models';
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
  selector: 'app-roles-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss'
})
export class RolesPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  selectedRole = signal<Role | null>(null);
  activeModal = signal<ModalType | null>(null);
  toasts = signal<Toast[]>([]);
  confirmDialog = signal<ConfirmState | null>(null);
  loading = signal(true);
  saving = signal<string | null>(null);

  private toastSeq = 0;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    permissionIds: [[] as number[]]
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    permissionIds: [[] as number[]]
  });

  canManage = computed(() => this.auth.hasPermission('ManageRoles'));

  stats = computed(() => {
    const roles = this.roles();
    const permissions = this.permissions();

    const totalPermissions = permissions.length;
    const totalRoles = roles.length;

    const totalAssigned = roles.reduce(
      (sum, role) => sum + (role.permissions?.length ?? 0),
      0
    );

    const avg = totalRoles ? Math.round(totalAssigned / totalRoles) : 0;

    const fullRoles = roles.filter(
      role => (role.permissions?.length ?? 0) === totalPermissions
    ).length;

    return {
      totalRoles,
      totalPermissions,
      avgPermissions: avg,
      fullRoles
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
      roles: this.ewms.getRoles(),
      permissions: this.ewms.getPermissions()
    }).subscribe({
      next: result => {
        this.roles.set(result.roles);
        this.permissions.set(result.permissions);
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
      this.showToast('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(null);
    this.createForm.reset({ permissionIds: [] });
    this.activeModal.set('create');
  }

  openEdit(role: Role) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(role);
    this.editForm.patchValue({
      name: role.name,
      permissionIds: role.permissions?.map(p => p.id) ?? []
    });
    this.activeModal.set('edit');
  }

  closeModal() {
    this.activeModal.set(null);
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء دور جديد' : 'تعديل الدور';
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
   * Permission toggle (checkbox)
   * ===================================================== */
  isPermissionSelected(modal: ModalType, permissionId: number): boolean {
    const form = modal === 'create' ? this.createForm : this.editForm;
    return (form.value.permissionIds ?? []).includes(permissionId);
  }

  togglePermission(modal: ModalType, permissionId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const form = modal === 'create' ? this.createForm : this.editForm;
    const current = form.value.permissionIds ?? [];

    const next = checked
      ? [...current, permissionId]
      : current.filter(id => id !== permissionId);

    form.patchValue({ permissionIds: next });
  }

  selectAllPermissions(modal: ModalType) {
    const form = modal === 'create' ? this.createForm : this.editForm;
    form.patchValue({ permissionIds: this.permissions().map(p => p.id) });
  }

  clearAllPermissions(modal: ModalType) {
    const form = modal === 'create' ? this.createForm : this.editForm;
    form.patchValue({ permissionIds: [] });
  }

  selectedPermissionsCount(modal: ModalType): number {
    const form = modal === 'create' ? this.createForm : this.editForm;
    return (form.value.permissionIds ?? []).length;
  }

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.createForm.value.name ?? '');
    for (const id of this.createForm.value.permissionIds ?? []) {
      form.append('PermissionIds', String(id));
    }

    this.save(
      'create',
      this.ewms.createRole(form),
      'تم إنشاء الدور بنجاح',
      () => {
        this.createForm.reset({ permissionIds: [] });
        this.closeModal();
      }
    );
  }

  update() {
    const role = this.selectedRole();
    if (!role || this.editForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.editForm.value.name ?? '');
    for (const id of this.editForm.value.permissionIds ?? []) {
      form.append('PermissionIds', String(id));
    }

    this.save(
      'edit',
      this.ewms.updateRole(role.id, form),
      'تم تعديل الدور بنجاح',
      () => this.closeModal()
    );
  }

  deleteRole(role: Role) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية حذف الأدوار', 'error');
      return;
    }

    this.askConfirm(
      `هل أنت متأكد من حذف الدور "${role.name}"؟ سيؤثر هذا على المستخدمين المرتبطين به.`,
      'تأكيد الحذف',
      () => this.performDelete(role)
    );
  }

  private performDelete(role: Role) {
    this.save(
      `delete-${role.id}`,
      this.ewms.deleteRole(role.id),
      'تم حذف الدور بنجاح',
      () => {
        if (this.selectedRole()?.id === role.id) {
          this.selectedRole.set(null);
        }
      }
    );
  }

  /* =====================================================
   * Helpers
   * ===================================================== */
  isFullRole(role: Role): boolean {
    const total = this.permissions().length;
    return total > 0 && (role.permissions?.length ?? 0) === total;
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