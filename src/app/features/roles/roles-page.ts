import { Pagination } from '../../core/utils/pagination';
import { Pager } from '../../shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Permission, Role } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PageActions } from '../../shared/ui/page-actions';
import { normalizePlaceText } from '../../core/utils/places';

type ModalType = 'create' | 'edit';

interface PermissionGroup { key: string; title: string; items: Permission[]; }
interface PermissionSection { key: string; title: string; groups: PermissionGroup[]; items: Permission[]; }

/**
 * شجرة الصلاحيات في نافذتي الدور: أقسام ثابتة (عناوين في أعلى القائمة) ← مجموعات قابلة للطي ← صلاحيات.
 * ما لا يرد هنا من صلاحيات جديدة يظهر في قسم "أخرى" فلا يضيع — أضفه لمجموعته حين تُضاف إلى AppPermissions في الباكاند.
 */
const PERMISSION_SECTIONS: { key: string; title: string; groups: { key: string; title: string; names: string[] }[] }[] = [
  { key: 'vacations', title: 'الإجازات', groups: [
    { key: 'vac-own', title: 'طلبات الإجازة', names: ['ViewVacations', 'CreateVacation', 'CancelVacation', 'PrintVacation'] },
    { key: 'vac-view', title: 'الاطلاع على إجازات الآخرين', names: ['ViewDepartmentVacations', 'ViewBranchVacations'] },
    { key: 'vac-approve', title: 'الموافقة على الإجازات', names: ['ApproveVacationFirst', 'ApproveVacationFinal'] },
    { key: 'vacation-types', title: 'أنواع الإجازات', names: ['ViewVacationTypes', 'CreateVacationType', 'EditVacationType', 'DeleteVacationType'] },
    { key: 'holidays', title: 'العطل الرسمية', names: ['ViewHolidays', 'CreateHoliday', 'EditHoliday', 'DeleteHoliday'] }
  ] },
  { key: 'tasks', title: 'المهام', groups: [
    { key: 'task-board', title: 'لوحة المهام', names: ['ViewTaskBoard', 'AssignTaskToDepartment', 'AssignTaskToOffice', 'AssignTaskToUser', 'HandleUnitTasks', 'ViewTaskStats'] },
    { key: 'todo-lists', title: 'مفكرتي — قوائم المهام الشخصية (قوائمه هو فقط؛ البنود والتثبيت والأرشفة بصلاحية التعديل)', names: ['ViewToDoLists', 'CreateToDoList', 'EditToDoList', 'DeleteToDoList'] },
    { key: 'work-tasks', title: 'مهام العمل', names: ['ViewMyWorkTasks', 'ViewWorkTasks', 'CreateWorkTask', 'EditWorkTask', 'DeleteWorkTask'] }
  ] },
  { key: 'maintenance', title: 'الصيانة', groups: [
    { key: 'maint-requests', title: 'طلبات الصيانة', names: ['ViewMaintenanceRequests', 'CreateMaintenanceRequest', 'EditMaintenanceRequest', 'ChangeMaintenanceStatus', 'DeleteMaintenanceRequest', 'AssignMaintenanceRequest', 'RequestMaintenanceTransfer'] },
    { key: 'maint-mine', title: 'متابعة أجهزتي في الصيانة', names: ['ViewMyMaintenanceRequests'] },
    { key: 'maint-devices', title: 'أجهزة الصيانة', names: ['ViewMaintenanceDevices', 'CreateMaintenanceDevice', 'EditMaintenanceDevice', 'DeleteMaintenanceDevice'] },
    { key: 'maint-parts', title: 'قطع الغيار (مخزون القسم والصرف على الطلبات)', names: ['ViewSpareParts', 'CreateSparePart', 'EditSparePart', 'DeleteSparePart', 'ReceiveSpareParts', 'AdjustSparePartStock', 'IssueSparePart', 'ViewSparePartReports'] },
    { key: 'maint-tasks', title: 'مهام الصيانة', names: ['ViewMaintenanceTasks', 'CreateMaintenanceTask', 'EditMaintenanceTask', 'DeleteMaintenanceTask', 'AssignMaintenanceTask'] },
    { key: 'maint-department', title: 'الإشراف على صيانة القسم', names: ['ViewDepartmentMaintenance', 'ViewMaintenanceStats', 'SignMaintenanceReceipt'] },
    { key: 'maint-lookups', title: 'جداول الصيانة (أنواع الأجهزة والشركات والأعطال والحالات)', names: ['ViewMaintenanceLookups', 'CreateMaintenanceLookup', 'EditMaintenanceLookup', 'DeleteMaintenanceLookup'] }
  ] },
  { key: 'general', title: 'عام', groups: [
    { key: 'notifications', title: 'الإشعارات', names: ['ViewNotifications'] },
    { key: 'signature', title: 'التوقيع الإلكتروني', names: ['ManageMySignature'] }
  ] },
  { key: 'devices', title: 'توثيق الأجهزة', groups: [
    { key: 'devices', title: 'المواقع والأجهزة والتركيبات', names: ['ViewDevices', 'CreateDevice', 'EditDevice', 'DeleteDevice', 'RevealDevicePasswords'] }
  ] },
  { key: 'dashboards', title: 'لوحات المتابعة', groups: [
    { key: 'dashboards', title: 'لوحات المتابعة', names: ['ViewOrganizationDashboard', 'ViewBranchDashboard', 'ViewDepartmentDashboard', 'ViewOfficeDashboard', 'ViewMyDashboard', 'ViewBranchMap'] }
  ] },
  { key: 'admin', title: 'الإدارة والهيكل', groups: [
    { key: 'users', title: 'الموظفون', names: ['ViewUsers', 'CreateUser', 'EditUser', 'ToggleUserActive', 'DeleteUser'] },
    { key: 'roles', title: 'الأدوار والصلاحيات', names: ['ViewRoles', 'CreateRole', 'EditRole', 'DeleteRole'] },
    { key: 'branches', title: 'الفروع', names: ['ViewBranches', 'CreateBranch', 'EditBranch', 'DeleteBranch'] },
    { key: 'departments', title: 'الأقسام', names: ['ViewDepartments', 'CreateDepartment', 'EditDepartment', 'DeleteDepartment'] },
    { key: 'offices', title: 'المكاتب', names: ['ViewOffices', 'CreateOffice', 'EditOffice', 'DeleteOffice'] }
  ] }
];

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss'
})
export class RolesPage {
  pager = new Pagination(() => this.filteredRoles());
  private ewms = inject(EwmsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  roles = signal<Role[]>([]);
  /** بحث في الأدوار: باسم الدور، أو باسم صلاحية يملكها أو وصفها العربي (مثل «اعتماد» أو ApproveVacationFinal) */
  search = signal('');
  /** دور اختير من قائمة الاقتراحات: يُعرض وحده في الجدول (يزول بالكتابة من جديد) */
  pickedId = signal<number | null>(null);
  suggestOpen = signal(false);
  activeSuggestion = signal(-1);

  /**
   * المطابقة: أدوار اسمها يحوي النص؛ وإن لم يوجد دور بهذا الاسم فالأدوار التي تملك صلاحية تطابقه (باسمها أو وصفها العربي).
   * هي نفسها ما يُعرض في الاقتراحات وفي الجدول، فلا يظهر دور لا يطابق.
   */
  private matched = computed(() => {
    const q = normalizePlaceText(this.search());
    if (!q) return [];
    const has = (text: string | null | undefined) => normalizePlaceText(text ?? '').includes(q);
    const byName = this.roles().filter(r => has(r.name));
    if (byName.length) return byName.map(role => ({ role, byName: true, via: '' }));
    return this.roles().filter(r => (r.permissions ?? []).some(p => has(p.name) || has(p.description)))
      .map(role => ({
        role, byName: false,
        via: (role.permissions ?? []).filter(p => has(p.name) || has(p.description)).slice(0, 2).map(p => p.name).join('، ')
      }));
  });
  filteredRoles = computed(() => {
    const picked = this.pickedId();
    if (picked !== null) return this.roles().filter(r => r.id === picked);
    return this.search().trim() ? this.matched().map(m => m.role) : this.roles();
  });
  /** اقتراحات تحت خانة البحث: المطابق فقط، حتى 8 */
  suggestions = computed(() => this.pickedId() !== null ? [] : this.matched().slice(0, 8));

  onSearchInput(value: string) {
    this.pickedId.set(null); this.search.set(value);
    this.suggestOpen.set(true); this.activeSuggestion.set(-1);
  }

  pickSuggestion(role: Role) {
    this.pickedId.set(role.id); this.search.set(role.name);
    this.suggestOpen.set(false); this.activeSuggestion.set(-1);
  }

  clearSearch() { this.pickedId.set(null); this.search.set(''); this.suggestOpen.set(false); }

  onSearchKey(event: KeyboardEvent) {
    const list = this.suggestions();
    if (event.key === 'Escape') { this.suggestOpen.set(false); return; }
    if (!list.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); this.suggestOpen.set(true); this.activeSuggestion.set((this.activeSuggestion() + 1) % list.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); this.activeSuggestion.set((this.activeSuggestion() - 1 + list.length) % list.length); }
    else if (event.key === 'Enter' && this.activeSuggestion() >= 0) { event.preventDefault(); this.pickSuggestion(list[this.activeSuggestion()].role); }
  }
  permissions = signal<Permission[]>([]);
  selectedRole = signal<Role | null>(null);
  activeModal = signal<ModalType | null>(null);
  loading = signal(true);
  private actions = new PageActions(() => this.load());
  saving = this.actions.saving;


  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    permissionIds: [[] as number[]]
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    permissionIds: [[] as number[]]
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
      roles: this.ewms.getRoles(), permissions: this.ewms.getPermissions(),
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
    this.createForm.reset({ permissionIds: [] });
    this.collapseAllGroups();
    this.activeSectionKey.set('');
    this.activeModal.set('create');
  }

  /**
   * نسخ دور: نافذة الإنشاء بنفس صلاحيات الدور ووحدته واسم مقترح — لإنشاء دور شخص جديد من دور مشابه
   * ثم تعديل الاسم والوحدة وما يختلف من صلاحيات (قرار المستخدم 2026-10-03: دور لكل شخص).
   */
  openClone(role: Role) {
    if (!this.canCreate()) {
      this.toast.show('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(null);
    this.collapseAllGroups();
    this.activeSectionKey.set('');
    this.createForm.reset({
      name: `${role.name} - نسخة`,
      permissionIds: role.permissions?.map(p => p.id) ?? []
    });
    this.activeModal.set('create');
  }

  openEdit(role: Role) {
    if (!this.canEdit()) {
      this.toast.show('لا تملك صلاحية إدارة الأدوار', 'error');
      return;
    }

    this.selectedRole.set(role);
    this.collapseAllGroups();
    this.activeSectionKey.set('');
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

  /* =====================================================
   * مجموعات الصلاحيات القابلة للطي
   * ===================================================== */
  /** الأقسام الثابتة ← مجموعاتها ← صلاحياتها (ما لا ينتمي لمجموعة يظهر في قسم "أخرى") */
  permissionSections = computed<PermissionSection[]>(() => {
    const all = this.permissions();
    const byName = new Map(all.map(p => [p.name, p]));
    const used = new Set<string>();

    const sections: PermissionSection[] = PERMISSION_SECTIONS.map(s => {
      const groups = s.groups
        .map(g => ({ key: g.key, title: g.title, items: g.names.map(n => byName.get(n)).filter((p): p is Permission => !!p) }))
        .filter(g => g.items.length);
      return { key: s.key, title: s.title, groups, items: groups.flatMap(g => g.items) };
    }).filter(s => s.items.length);

    sections.forEach(s => s.items.forEach(p => used.add(p.name)));
    const others = all.filter(p => !used.has(p.name));
    if (others.length) sections.push({ key: 'others', title: 'أخرى', groups: [{ key: 'others', title: 'أخرى', items: others }], items: others });

    return sections;
  });

  permissionGroups = computed<PermissionGroup[]>(() => this.permissionSections().flatMap(s => s.groups));

  /** القسم المعروض تحت العناوين الثابتة */
  private activeSectionKey = signal('');
  activeSection = computed(() => {
    const sections = this.permissionSections();
    return sections.find(s => s.key === this.activeSectionKey()) ?? sections[0] ?? null;
  });

  selectSection(key: string) { this.activeSectionKey.set(key); }

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

  /** توسيع/طيّ مجموعات القسم المعروض */
  expandAllGroups() { this.openGroups.set(new Set(this.activeSection()?.groups.map(g => g.key) ?? [])); }
  collapseAllGroups() { this.openGroups.set(new Set()); }

  /** عدد المختار من مجموعة أو قسم كامل */
  groupSelectedCount(modal: ModalType, group: { items: Permission[] }): number {
    const form = modal === 'create' ? this.createForm : this.editForm;
    const selected = new Set(form.value.permissionIds ?? []);
    return group.items.filter(p => selected.has(p.id)).length;
  }

  /** تحديد/إلغاء كل صلاحيات المجموعة أو القسم (بدون المساس بالباقي) */
  toggleGroupSelection(modal: ModalType, group: { items: Permission[] }, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const form = modal === 'create' ? this.createForm : this.editForm;
    const ids = new Set(group.items.map(p => p.id));
    const rest = (form.value.permissionIds ?? []).filter(id => !ids.has(id));
    const next = checked ? [...rest, ...ids] : rest;
    form.patchValue({ permissionIds: next });
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
    const all = this.permissions().map(p => p.id);
    form.patchValue({ permissionIds: all });
  }

  clearAllPermissions(modal: ModalType) {
    const form = modal === 'create' ? this.createForm : this.editForm;
    form.patchValue({ permissionIds: [] });
  }

  selectedPermissionsCount(modal: ModalType): number {
    const form = modal === 'create' ? this.createForm : this.editForm;
    return (form.value.permissionIds ?? []).length;
  }

  private appendRole(data: FormData, form: FormGroup) {
    for (const id of form.value.permissionIds ?? []) data.append('PermissionIds', String(id));
  }

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid) return;

    const form = new FormData();
    form.append('Name', this.createForm.value.name ?? '');
    this.appendRole(form, this.createForm);

    this.actions.run(
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
    this.appendRole(form, this.editForm);

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
