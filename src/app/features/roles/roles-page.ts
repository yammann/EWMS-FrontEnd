import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Permission, Role } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission, AppRole } from '../../core/constants/access';
import { PERMISSION_SCOPES, ROLE_LEVELS, defaultScopeFor, roleLevelLabel } from '../../core/utils/roles';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PageActions } from '../../shared/ui/page-actions';

type ModalType = 'create' | 'edit';

interface PermissionGroup { key: string; title: string; items: Permission[]; }

/**
 * مجموعات الصلاحيات في نافذتي الدور (بحسب الميزة). ما لا يرد هنا من صلاحيات جديدة يظهر تحت "أخرى"
 * فلا يضيع — أضفه لمجموعته حين تُضاف الصلاحية إلى AppPermissions في الباكاند.
 */
const PERMISSION_GROUPS: { key: string; title: string; names: string[] }[] = [
  { key: 'vacations', title: 'الإجازات', names: ['ViewVacations', 'CreateVacation', 'CancelVacation', 'ApproveVacation'] },
  { key: 'vacation-types', title: 'أنواع الإجازات', names: ['ViewVacationTypes', 'CreateVacationType', 'EditVacationType', 'DeleteVacationType'] },
  { key: 'work-tasks', title: 'مهام العمل', names: ['ViewWorkTasks', 'CreateWorkTask', 'EditWorkTask', 'DeleteWorkTask'] },
  { key: 'task-board', title: 'لوحة المهام', names: ['ViewAssignedTasks', 'CreateAssignedTask'] },
  { key: 'devices', title: 'توثيق الأجهزة', names: ['ViewDevices', 'CreateDevice', 'EditDevice', 'DeleteDevice'] },
  { key: 'maint-requests', title: 'طلبات الصيانة', names: ['ViewMaintenanceRequests', 'CreateMaintenanceRequest', 'EditMaintenanceRequest', 'DeleteMaintenanceRequest', 'AssignMaintenanceRequest'] },
  { key: 'maint-tasks', title: 'مهام الصيانة', names: ['ViewMaintenanceTasks', 'CreateMaintenanceTask', 'EditMaintenanceTask', 'DeleteMaintenanceTask', 'AssignMaintenanceTask'] },
  { key: 'maint-lookups', title: 'جداول الصيانة (أنواع الأجهزة والشركات والأعطال والحالات)', names: ['ViewMaintenanceLookups', 'CreateMaintenanceLookup', 'EditMaintenanceLookup', 'DeleteMaintenanceLookup'] },
  { key: 'users', title: 'الموظفون', names: ['ViewUsers', 'CreateUser', 'EditUser', 'DeleteUser'] },
  { key: 'roles', title: 'الأدوار والصلاحيات', names: ['ViewRoles', 'CreateRole', 'EditRole', 'DeleteRole'] },
  { key: 'branches', title: 'الفروع', names: ['ViewBranches', 'CreateBranch', 'EditBranch', 'DeleteBranch'] },
  { key: 'departments', title: 'الأقسام', names: ['ViewDepartments', 'CreateDepartment', 'EditDepartment', 'DeleteDepartment'] },
  { key: 'offices', title: 'المكاتب', names: ['ViewOffices', 'CreateOffice', 'EditOffice', 'DeleteOffice'] },
  { key: 'modules', title: 'إسناد الخدمات', names: ['ViewModuleAssignments', 'EditModuleAssignments'] }
];

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss'
})
export class RolesPage {
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  selectedRole = signal<Role | null>(null);
  activeModal = signal<ModalType | null>(null);
  loading = signal(true);
  private actions = new PageActions(() => this.load());
  saving = this.actions.saving;

  levels = ROLE_LEVELS;
  scopeOptions = PERMISSION_SCOPES;
  levelLabel = roleLevelLabel;
  /** تلميح المستوى المختار */
  levelHint(level: string | null | undefined): string {
    return ROLE_LEVELS.find(l => l.value === level)?.hint ?? '';
  }
  superAdminLevel = AppRole.SuperAdmin;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    level: [AppRole.Employee as string, Validators.required],
    permissionIds: [[] as number[]],
    /** نطاق كل صلاحية مختارة ذات نطاق: معرّف الصلاحية ← 1..5 */
    scopes: this.fb.nonNullable.control<Record<number, number>>({})
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    level: [AppRole.Employee as string, Validators.required],
    permissionIds: [[] as number[]],
    /** نطاق كل صلاحية مختارة ذات نطاق: معرّف الصلاحية ← 1..5 */
    scopes: this.fb.nonNullable.control<Record<number, number>>({})
  });

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateRole));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditRole));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteRole));

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
      error: error => { this.loading.set(false); this.actions.loadFailed(error); }
    });
  }

  /* =====================================================
   * Modal control
   * ===================================================== */
  openCreate() {
    if (!this.canCreate()) {
      this.toast.show('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(null);
    this.createForm.reset({ level: AppRole.Employee, permissionIds: [], scopes: {} });
    this.collapseAllGroups();
    this.activeModal.set('create');
  }

  openEdit(role: Role) {
    if (!this.canEdit()) {
      this.toast.show('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(role);
    this.collapseAllGroups();
    this.editForm.patchValue({
      name: role.name,
      level: role.level,
      scopes: Object.fromEntries((role.permissions ?? []).filter(p => p.scoped && p.scope).map(p => [p.id, p.scope!])),
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

  /* =====================================================
   * مجموعات الصلاحيات القابلة للطي
   * ===================================================== */
  permissionGroups = computed<PermissionGroup[]>(() => {
    const all = this.permissions();
    const byName = new Map(all.map(p => [p.name, p]));
    const used = new Set<string>();

    const groups = PERMISSION_GROUPS
      .map(g => ({
        key: g.key, title: g.title,
        items: g.names.map(n => byName.get(n)).filter((p): p is Permission => !!p)
      }))
      .filter(g => g.items.length);

    groups.forEach(g => g.items.forEach(p => used.add(p.name)));
    const others = all.filter(p => !used.has(p.name));
    if (others.length) groups.push({ key: 'others', title: 'أخرى', items: others });

    return groups;
  });

  /** المجموعات المفتوحة (الافتراضي: كلها مطوية) */
  private openGroups = signal<ReadonlySet<string>>(new Set());

  isGroupOpen(key: string): boolean { return this.openGroups().has(key); }

  toggleGroupOpen(key: string) {
    this.openGroups.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  expandAllGroups() { this.openGroups.set(new Set(this.permissionGroups().map(g => g.key))); }
  collapseAllGroups() { this.openGroups.set(new Set()); }

  groupSelectedCount(modal: ModalType, group: PermissionGroup): number {
    const form = modal === 'create' ? this.createForm : this.editForm;
    const selected = new Set(form.value.permissionIds ?? []);
    return group.items.filter(p => selected.has(p.id)).length;
  }

  /** تحديد/إلغاء كل صلاحيات المجموعة (بدون المساس بباقي المجموعات) */
  toggleGroupSelection(modal: ModalType, group: PermissionGroup, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const form = modal === 'create' ? this.createForm : this.editForm;
    const ids = new Set(group.items.map(p => p.id));
    const rest = (form.value.permissionIds ?? []).filter(id => !ids.has(id));
    const next = checked ? [...rest, ...ids] : rest;
    form.patchValue({ permissionIds: next, scopes: this.withDefaultScopes(form, next) });
  }

  /* =====================================================
   * نطاق الصلاحية (لكل صلاحية ذات نطاق: على أي سجلات تعمل)
   * ===================================================== */
  scopeOf(modal: ModalType, permission: Permission): number {
    const form = modal === 'create' ? this.createForm : this.editForm;
    return form.value.scopes?.[permission.id] ?? defaultScopeFor(form.value.level);
  }

  setScope(modal: ModalType, permission: Permission, event: Event) {
    const form = modal === 'create' ? this.createForm : this.editForm;
    const value = Number((event.target as HTMLSelectElement).value);
    form.patchValue({ scopes: { ...(form.value.scopes ?? {}), [permission.id]: value } });
  }

  /** يُبقي نطاقات المختار، ويعطي الجديد النطاق الافتراضي لمستوى الدور، ويحذف نطاق ما أُلغي */
  private withDefaultScopes(form: FormGroup, ids: number[]): Record<number, number> {
    const current = (form.value.scopes ?? {}) as Record<number, number>;
    const fallback = defaultScopeFor(form.value.level);
    const scopedIds = new Set(this.permissions().filter(p => p.scoped).map(p => p.id));
    return Object.fromEntries(ids.filter(id => scopedIds.has(id)).map(id => [id, current[id] ?? fallback]));
  }

  /** النطاقات بنفس ترتيب المعرّفات (0 = الافتراضي لمستوى الدور) */
  private appendGrants(data: FormData, form: FormGroup) {
    const scopes = (form.value.scopes ?? {}) as Record<number, number>;
    for (const id of form.value.permissionIds ?? []) {
      data.append('PermissionIds', String(id));
      data.append('PermissionScopes', String(scopes[id] ?? 0));
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

    form.patchValue({ permissionIds: next, scopes: this.withDefaultScopes(form, next) });
  }

  selectAllPermissions(modal: ModalType) {
    const form = modal === 'create' ? this.createForm : this.editForm;
    const all = this.permissions().map(p => p.id);
    form.patchValue({ permissionIds: all, scopes: this.withDefaultScopes(form, all) });
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
    form.append('Level', this.createForm.value.level ?? AppRole.Employee);
    this.appendGrants(form, this.createForm);

    this.actions.run(
      'create',
      this.ewms.createRole(form),
      'تم إنشاء الدور بنجاح',
      () => {
        this.createForm.reset({ level: AppRole.Employee, permissionIds: [], scopes: {} });
        this.closeModal();
      }
    );
  }

  update() {
    const role = this.selectedRole();
    if (!role || this.editForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.editForm.value.name ?? '');
    form.append('Level', this.editForm.value.level ?? AppRole.Employee);
    this.appendGrants(form, this.editForm);

    this.actions.run(
      'edit',
      this.ewms.updateRole(role.id, form),
      'تم تعديل الدور بنجاح',
      () => this.closeModal()
    );
  }

  deleteRole(role: Role) {
    if (!this.canDelete()) {
      this.toast.show('لا تملك صلاحية حذف الأدوار', 'error');
      return;
    }

    this.confirm.ask(
      `هل أنت متأكد من حذف الدور "${role.name}"؟ سيؤثر هذا على المستخدمين المرتبطين به.`,
      'تأكيد الحذف'
    ).then(confirmed => { if (confirmed) this.performDelete(role); });
  }

  private performDelete(role: Role) {
    this.actions.run(
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
}
