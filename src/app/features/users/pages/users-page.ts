import { Pagination } from '@core/utils/pagination';
import { loader } from '@shared/ui/loader';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';
import { utcDate } from '@core/utils/format';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Branch, Department, Office, Role, User } from '@core/models/ewms.models';
import { UserService } from '../data-access/user.service';
import { LookupsService } from '@core/services/lookups.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { PageActions } from '@shared/ui/page-actions';

type ModalType = 'create' | 'edit';
/** أي حقول المكان تُعرض في نموذج الموظف */
type UserPlacement = { needsBranch: boolean; needsDepartment: boolean; needsOffice: boolean };

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss'
})
export class UsersPage {
  private userService = inject(UserService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  users = signal<User[]>([]);
  pager = new Pagination(() => this.users());
  branches = signal<Branch[]>([]);
  departments = signal<Department[]>([]);
  offices = signal<Office[]>([]);
  roles = signal<Role[]>([]);
  selectedUser = signal<User | null>(null);
  activeModal = signal<ModalType | null>(null);
  private actions = new PageActions(() => this.load(true));
  saving = this.actions.saving;
  phone = formatPhone;
  utc = utcDate;

  createForm = this.fb.group({
    officeId: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    personalIdNumber: ['', [Validators.maxLength(20), Validators.pattern(/^s*[A-Za-z0-9-]*s*$/)]],
    phoneNumber: ['', (c: AbstractControl<string | null>) => isValidPhone(c.value) ? null : { phone: true }],
    password: ['', [Validators.required, Validators.minLength(6)]],
    roleId: ['', Validators.required],
    departmentId: [''],
    branchId: ['']
  });

  editForm = this.fb.group({
    officeId: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    personalIdNumber: ['', [Validators.maxLength(20), Validators.pattern(/^s*[A-Za-z0-9-]*s*$/)]],
    phoneNumber: ['', (c: AbstractControl<string | null>) => isValidPhone(c.value) ? null : { phone: true }],
    password: [''],
    roleId: ['', Validators.required],
    departmentId: [''],
    branchId: [''],
    isActive: [true]
  });

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateUser));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditUser));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteUser));

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
    // تغيير الدور يحدد أي الحقول (فرع/قسم/مكتب) مطلوبة
    this.createForm.controls.roleId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyPlacement(this.createForm));
    this.editForm.controls.roleId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyPlacement(this.editForm));
  }

  /* =====================================================
   * Data loading
   * ===================================================== */
  private force = false;
  private data = loader(() => forkJoin({
    users: this.userService.getAll(),
    branches: this.lookups.branchOptions(this.force),
    departments: this.lookups.departments(this.force),
    offices: this.lookups.offices(this.force),
    roles: this.lookups.roles(this.force)
  }), null, {
    onLoaded: result => {
      if (!result) return;
      this.users.set(result.users);
      this.branches.set(result.branches);
      this.departments.set(result.departments);
      this.offices.set(result.offices);
      this.roles.set(result.roles);
    },
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
      this.toast.show('لا تملك صلاحية إدارة المستخدمين', 'error');
      return;
    }

    this.selectedUser.set(null);
    this.createForm.reset();
    this.activeModal.set('create');
    this.applyPlacement(this.createForm);
  }

  openEdit(user: User) {
    if (!this.canEdit()) {
      this.toast.show('لا تملك صلاحية إدارة المستخدمين', 'error');
      return;
    }

    this.selectedUser.set(user);
    this.editForm.patchValue({
      officeId: user.officeId ? String(user.officeId) : '',
      fullName: user.fullName,
      email: user.email,
      personalIdNumber: user.personalIdNumber ?? '',
      phoneNumber: user.phoneNumber ?? '',
      password: '',
      roleId: String(user.roleId),
      departmentId: user.departmentId ? String(user.departmentId) : '',
      branchId: user.branchId ? String(user.branchId) : '',
      isActive: user.isActive
    });
    // تفعيل الحساب وتعطيله بصلاحية منفصلة: من لا يملكها يرى الخيار معطلاً (القيمة ترسل كما هي)
    const toggle = this.editForm.controls.isActive;
    if (this.auth.hasPermission(AppPermission.ToggleUserActive)) toggle.enable(); else toggle.disable();
    this.activeModal.set('edit');
    this.applyPlacement(this.editForm);
  }

  closeModal() {
    this.activeModal.set(null);
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء مستخدم جديد' : 'تعديل المستخدم';
  }

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid || this.saving() || !this.validAssignment()) return;

    const form = new FormData();
    form.append('FullName', this.createForm.value.fullName ?? '');
    form.append('Email', this.createForm.value.email ?? '');
    form.append('PersonalIdNumber', (this.createForm.value.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(this.createForm.value.phoneNumber));
    form.append('Password', this.createForm.value.password ?? '');
    form.append('RoleId', this.createForm.value.roleId ?? '');
    this.appendPlacement(form, this.createForm);

    this.actions.run(
      'create',
      this.userService.create(form),
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
    form.append('PersonalIdNumber', (this.editForm.value.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(this.editForm.value.phoneNumber));
    form.append('RoleId', this.editForm.value.roleId ?? '');
    this.appendPlacement(form, this.editForm);
    form.append('IsActive', String(this.editForm.getRawValue().isActive ?? true));

    // كلمة المرور تُرسَل فقط إن أراد المستخدم تغييرها
    if (this.editForm.value.password) {
      form.append('Password', this.editForm.value.password);
    }

    this.actions.run(
      'edit',
      this.userService.update(user.id, form),
      'تم تعديل المستخدم بنجاح',
      () => this.closeModal()
    );
  }

  deleteUser(user: User) {
    if (!this.canDelete()) {
      this.toast.show('لا تملك صلاحية حذف المستخدمين', 'error');
      return;
    }

    this.confirm.ask(
      `هل أنت متأكد من حذف المستخدم "${user.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف'
    ).then(confirmed => { if (confirmed) this.performDelete(user); });
  }

  private performDelete(user: User) {
    this.actions.run(
      `delete-${user.id}`,
      this.userService.delete(user.id),
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
   * مكان الموظف (فرع / قسم / مكتب): يُحدَّد هنا لا في الدور، وكلها اختيارية —
   * مدير النظام (SuperAdmin) وحده لا يتبع لوحدة. الباكاند يشتق الأعلى من الأدق ويرفض التعارض.
   * ===================================================== */
  private activeForm(): FormGroup {
    return this.activeModal() === 'create' ? this.createForm : this.editForm;
  }

  /** "needs…" هنا تعني: يُعرض الحقل (لا يُلزم) */
  private placementOf(form: FormGroup): UserPlacement {
    // قيمة الحقل نفسه وليس form.value: داخل valueChanges للدور لم تُحدَّث قيمة النموذج بعد
    const role = this.roles().find(r => String(r.id) === String(form.get('roleId')?.value));
    const placed = role?.name?.toLowerCase() !== 'superadmin';
    return { needsBranch: placed, needsDepartment: placed, needsOffice: placed };
  }

  placement(): UserPlacement {
    return this.placementOf(this.activeForm());
  }

  // الحقول المخفية (دور SuperAdmin) تُفرَّغ؛ لا حقل إجباري
  private applyPlacement(form: FormGroup) {
    const placement = this.placementOf(form);
    const fields: [string, boolean][] = [
      ['branchId', placement.needsBranch],
      ['departmentId', placement.needsDepartment],
      ['officeId', placement.needsOffice]
    ];
    for (const [name, shown] of fields) {
      const control = form.get(name)!;
      control.setValidators(null);
      if (!shown) control.setValue('', { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private appendPlacement(data: FormData, form: FormGroup) {
    const placement = this.placementOf(form);
    if (!placement.needsBranch) return;
    // الفارغ لا يُرسل: الباكاند يعتبره بلا وحدة
    for (const [key, value] of [['BranchId', form.value.branchId], ['DepartmentId', form.value.departmentId], ['OfficeId', form.value.officeId]]) {
      if (value) data.append(key, String(value));
    }
  }

  /** التعارض فقط (قسم خارج الفرع المختار، أو مكتب خارج القسم المختار) — الفراغ مسموح */
  private validAssignment(): boolean {
    const value = this.activeForm().value;
    const department = this.departments().find(d => d.id === Number(value.departmentId));
    const office = this.offices().find(o => o.id === Number(value.officeId));
    const invalid =
      (value.branchId && department && department.branchId !== Number(value.branchId))
      || (value.departmentId && office && office.departmentId !== Number(value.departmentId));
    if (invalid) {
      this.toast.show('تحقق من تبعية القسم للفرع والمكتب للقسم', 'error');
      return false;
    }
    return true;
  }
}
