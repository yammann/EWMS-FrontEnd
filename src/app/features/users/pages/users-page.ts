import { Pagination } from '@core/utils/pagination';
import { RowActions } from '@shared/ui/row-actions';
import { StatTile } from '@shared/ui/stat-tile';
import { AdminHeader } from '@shared/ui/admin-header';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';
import { utcDate } from '@core/utils/format';
import { forkJoin, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Branch, Department, Office, Role, User } from '@core/models/ewms.models';
import { UserService } from '../data-access/user.service';
import { LookupsService } from '@core/services/lookups.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';

/** أي حقول المكان تُعرض في نموذج الموظف */
type UserPlacement = { needsBranch: boolean; needsDepartment: boolean; needsOffice: boolean };

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [Alert, RowActions, StatTile, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss'
})
export class UsersPage {
  private userService = inject(UserService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  branches = signal<Branch[]>([]);
  departments = signal<Department[]>([]);
  offices = signal<Office[]>([]);
  roles = signal<Role[]>([]);
  phone = formatPhone;
  utc = utcDate;

  createForm = this.fb.group({
    officeId: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    personalIdNumber: ['', [Validators.maxLength(20), Validators.pattern(/^\s*[A-Za-z0-9-]*\s*$/)]],
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
    personalIdNumber: ['', [Validators.maxLength(20), Validators.pattern(/^\s*[A-Za-z0-9-]*\s*$/)]],
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

  crud = new CrudPage<User, FormData>({
    // المستخدمون + قوائم النموذج (الفروع/الأقسام/المكاتب/الأدوار من التخزين المشترك إن كانت حديثة)
    load: () => forkJoin({
      users: this.userService.getAll(),
      branches: this.lookups.branchOptions(),
      departments: this.lookups.departments(),
      offices: this.lookups.offices(),
      roles: this.lookups.roles()
    }).pipe(map(r => {
      this.branches.set(r.branches); this.departments.set(r.departments); this.offices.set(r.offices); this.roles.set(r.roles);
      return r.users;
    })),
    create: body => this.userService.create(body),
    update: (id, body) => this.userService.update(id, body),
    remove: u => this.userService.delete(u.id),
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    onOpen: user => user ? this.fillEdit(user) : (this.createForm.reset(), this.applyPlacement(this.createForm)),
    onRefresh: () => this.lookups.invalidate(),
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء المستخدم بنجاح' : 'تم تعديل المستخدم بنجاح',
      deleted: 'تم حذف المستخدم بنجاح', plural: 'المستخدمين', confirmLabel: 'تأكيد الحذف',
      confirmDelete: u => `هل أنت متأكد من حذف المستخدم "${u.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`
    }
  });

  users = this.crud.items;
  pager = new Pagination(() => this.users());
  /** نوع النافذة المفتوحة */
  mode = computed(() => this.crud.dialog()?.mode ?? null);

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

  private fillEdit(user: User) {
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
    this.applyPlacement(this.editForm);
  }

  title() { return this.mode() === 'create' ? 'إنشاء مستخدم جديد' : 'تعديل المستخدم'; }

  create() {
    if (this.createForm.invalid || this.crud.saving() || !this.validAssignment()) return;
    const v = this.createForm.value;
    const form = new FormData();
    form.append('FullName', v.fullName ?? '');
    form.append('Email', v.email ?? '');
    form.append('PersonalIdNumber', (v.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(v.phoneNumber));
    form.append('Password', v.password ?? '');
    form.append('RoleId', v.roleId ?? '');
    this.appendPlacement(form, this.createForm);
    this.crud.save(form);
  }

  update() {
    if (this.editForm.invalid || this.crud.saving() || !this.validAssignment()) return;
    const v = this.editForm.value;
    const form = new FormData();
    form.append('FullName', v.fullName ?? '');
    form.append('Email', v.email ?? '');
    form.append('PersonalIdNumber', (v.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(v.phoneNumber));
    form.append('RoleId', v.roleId ?? '');
    this.appendPlacement(form, this.editForm);
    form.append('IsActive', String(this.editForm.getRawValue().isActive ?? true));
    // كلمة المرور تُرسَل فقط إن أراد المستخدم تغييرها
    if (v.password) form.append('Password', v.password);
    this.crud.save(form);
  }

  /* =====================================================
   * Helpers
   * ===================================================== */
  filteredDepartments(): Department[] {
    const branchId = this.mode() === 'create'
      ? this.createForm.value.branchId
      : this.editForm.value.branchId;

    if (!branchId) return this.departments();
    return this.departments().filter(d => String(d.branchId) === String(branchId));
  }

  filteredOffices(): Office[] {
    const form = this.mode() === 'create' ? this.createForm : this.editForm;
    return this.offices().filter(o => o.departmentId === Number(form.value.departmentId));
  }

  branchChanged() {
    const form = this.mode() === 'create' ? this.createForm : this.editForm;
    form.patchValue({ departmentId: '', officeId: '' });
  }

  departmentChanged() {
    const form = this.mode() === 'create' ? this.createForm : this.editForm;
    form.patchValue({ officeId: '' });
  }

  /* =====================================================
   * مكان الموظف (فرع / قسم / مكتب): يُحدَّد هنا لا في الدور، وكلها اختيارية —
   * مدير النظام (SuperAdmin) وحده لا يتبع لوحدة. الباكاند يشتق الأعلى من الأدق ويرفض التعارض.
   * ===================================================== */
  private activeForm(): FormGroup {
    return this.mode() === 'create' ? this.createForm : this.editForm;
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
      this.crud.fail('تحقق من تبعية القسم للفرع والمكتب للقسم');
      return false;
    }
    return true;
  }
}
