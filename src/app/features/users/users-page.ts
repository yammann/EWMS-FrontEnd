import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Branch, Department, Office, Role, User } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';
import { UserPlacement, placementForRole } from '../../core/utils/user-placement';

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
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss'
})
export class UsersPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  users = signal<User[]>([]);
  branches = signal<Branch[]>([]);
  departments = signal<Department[]>([]);
  offices = signal<Office[]>([]);
  roles = signal<Role[]>([]);
  selectedUser = signal<User | null>(null);
  activeModal = signal<ModalType | null>(null);
  toasts = signal<Toast[]>([]);
  confirmDialog = signal<ConfirmState | null>(null);
  loading = signal(true);
  saving = signal<string | null>(null);

  private toastSeq = 0;

  createForm = this.fb.group({
    officeId: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    roleId: ['', Validators.required],
    departmentId: [''],
    branchId: ['']
  });

  editForm = this.fb.group({
    officeId: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    roleId: ['', Validators.required],
    departmentId: [''],
    branchId: [''],
    isActive: [true]
  });

  canManage = computed(() => this.auth.hasPermission('ManageUsers'));

  stats = computed(() => {
    const users = this.users();

    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      roles: this.roles().length
    };
  });

  constructor() {
    this.load();
    // تغيير الدور يحدد أي الحقول (فرع/قسم/مكتب) مطلوبة
    this.createForm.controls.roleId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyPlacement(this.createForm));
    this.editForm.controls.roleId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyPlacement(this.editForm));
  }

  /* =====================================================
   * Data loading
   * ===================================================== */
  load() {
    this.loading.set(true);
    forkJoin({
      users: this.ewms.getUsers(),
      branches: this.ewms.getBranchLookup(),
      departments: this.ewms.getDepartments(),
      offices: this.ewms.getOffices(),
      roles: this.ewms.getRoles()
    }).subscribe({
      next: result => {
        this.users.set(result.users);
        this.branches.set(result.branches);
        this.departments.set(result.departments);
        this.offices.set(result.offices);
        this.roles.set(result.roles);
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
      this.showToast('لا تملك صلاحية إدارة المستخدمين', 'error');
      return;
    }

    this.selectedUser.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
    this.applyPlacement(this.createForm);
  }

  openEdit(user: User) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية إدارة المستخدمين', 'error');
      return;
    }

    this.selectedUser.set(user);
    this.editForm.patchValue({
      officeId: user.officeId ? String(user.officeId) : '',
      fullName: user.fullName,
      email: user.email,
      password: '',
      roleId: String(user.roleId),
      departmentId: user.departmentId ? String(user.departmentId) : '',
      branchId: user.branchId ? String(user.branchId) : '',
      isActive: user.isActive
    });
    this.activeModal.set('edit');
    this.applyPlacement(this.editForm);
  }

  closeModal() {
    this.activeModal.set(null);
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء مستخدم جديد' : 'تعديل المستخدم';
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
    if (this.createForm.invalid || this.saving() || !this.validAssignment()) return;

    const form = new FormData();
    form.append('FullName', this.createForm.value.fullName ?? '');
    form.append('Email', this.createForm.value.email ?? '');
    form.append('Password', this.createForm.value.password ?? '');
    form.append('RoleId', this.createForm.value.roleId ?? '');
    this.appendPlacement(form, this.createForm);

    this.save(
      'create',
      this.ewms.createUser(form),
      'تم إنشاء المستخدم بنجاح',
      () => {
        this.createForm.reset();
        this.closeModal();
      }
    );
  }

  update() {
    const user = this.selectedUser();
    if (!user || this.editForm.invalid || this.saving() || !this.validAssignment()) return;

    const form = new FormData();
    form.append('FullName', this.editForm.value.fullName ?? '');
    form.append('Email', this.editForm.value.email ?? '');
    form.append('RoleId', this.editForm.value.roleId ?? '');
    this.appendPlacement(form, this.editForm);
    form.append('IsActive', String(this.editForm.value.isActive ?? true));

    // كلمة المرور تُرسَل فقط إن أراد المستخدم تغييرها
    if (this.editForm.value.password) {
      form.append('Password', this.editForm.value.password);
    }

    this.save(
      'edit',
      this.ewms.updateUser(user.id, form),
      'تم تعديل المستخدم بنجاح',
      () => this.closeModal()
    );
  }

  deleteUser(user: User) {
    if (!this.canManage()) {
      this.showToast('لا تملك صلاحية حذف المستخدمين', 'error');
      return;
    }

    this.askConfirm(
      `هل أنت متأكد من حذف المستخدم "${user.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف',
      () => this.performDelete(user)
    );
  }

  private performDelete(user: User) {
    this.save(
      `delete-${user.id}`,
      this.ewms.deleteUser(user.id),
      'تم حذف المستخدم بنجاح',
      () => {
        if (this.selectedUser()?.id === user.id) {
          this.selectedUser.set(null);
        }
      }
    );
  }

  /* =====================================================
   * Helpers
   * ===================================================== */
  filteredDepartments(): Department[] {
    const branchId = this.activeModal() === 'create'
      ? this.createForm.value.branchId
      : this.editForm.value.branchId;

    if (!branchId) return this.departments();
    return this.departments().filter(d => String(d.branchId) === String(branchId));
  }

  filteredOffices(): Office[] {
    const form = this.activeModal() === 'create' ? this.createForm : this.editForm;
    return this.offices().filter(o => o.departmentId === Number(form.value.departmentId));
  }

  branchChanged() {
    const form = this.activeModal() === 'create' ? this.createForm : this.editForm;
    form.patchValue({ departmentId: '', officeId: '' });
  }

  departmentChanged() {
    const form = this.activeModal() === 'create' ? this.createForm : this.editForm;
    form.patchValue({ officeId: '' });
  }

  /* =====================================================
   * التبعية حسب الدور: SuperAdmin بلا فرع، رئيس الفرع بلا قسم، رئيس القسم بلا مكتب
   * ===================================================== */
  private activeForm(): FormGroup {
    return this.activeModal() === 'create' ? this.createForm : this.editForm;
  }

  private placementOf(form: FormGroup): UserPlacement {
    const role = this.roles().find(r => String(r.id) === String(form.value.roleId));
    return placementForRole(role?.name);
  }

  placement(): UserPlacement {
    return this.placementOf(this.activeForm());
  }

  // الحقول المطلوبة للدور تصبح إجبارية، وغير المطلوبة تُفرَّغ وتُعفى من التحقق
  private applyPlacement(form: FormGroup) {
    const placement = this.placementOf(form);
    const fields: [string, boolean][] = [
      ['branchId', placement.needsBranch],
      ['departmentId', placement.needsDepartment],
      ['officeId', placement.needsOffice]
    ];
    for (const [name, needed] of fields) {
      const control = form.get(name)!;
      control.setValidators(needed ? Validators.required : null);
      if (!needed) control.setValue('', { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private appendPlacement(data: FormData, form: FormGroup) {
    const placement = this.placementOf(form);
    if (placement.needsBranch) data.append('BranchId', form.value.branchId ?? '');
    if (placement.needsDepartment) data.append('DepartmentId', form.value.departmentId ?? '');
    if (placement.needsOffice) data.append('OfficeId', form.value.officeId ?? '');
  }

  private validAssignment(): boolean {
    const form = this.activeForm();
    const value = form.value;
    const placement = this.placementOf(form);
    const department = this.departments().find(d => d.id === Number(value.departmentId));
    const invalid =
      (placement.needsDepartment && (!department || department.branchId !== Number(value.branchId)))
      || (placement.needsOffice && !this.filteredOffices().some(o => o.id === Number(value.officeId)));
    if (invalid) {
      this.showToast('تحقق من تبعية القسم للفرع والمكتب للقسم', 'error');
      return false;
    }
    return true;
  }

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
