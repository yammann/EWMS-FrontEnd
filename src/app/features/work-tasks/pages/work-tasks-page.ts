import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { LookupsService } from '@core/services/lookups.service';
import { Branch, User } from '@core/models/ewms.models';
import { Pagination } from '@core/utils/pagination';
import { roleLabel } from '@core/utils/roles';
import { UserService } from '@features/users';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { EmptyState } from '@shared/ui/empty-state';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { WorkTaskService } from '../data-access/work-task.service';
import { WorkTask, WorkTaskRequest } from '../data-access/work-task.models';
import { SelectValue } from '@shared/ui/select-value';

const ICONS = ['📋', '📦', '🧾', '📊', '🛠️', '💻', '🚚', '🔧', '📁', '🧮', '🗂️', '📞'];

/** إدارة مهام العمل لكل فرع وإسنادها لموظفيه — النمط الموحّد (CrudPage) بنافذة كبيرة */
@Component({
  selector: 'app-work-tasks-page', standalone: true,
  imports: [SelectValue, PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager, Modal, FormActions, RowActions],
  styleUrls: ['../../../shared/styles/page-base.scss', './work-tasks-page.scss'],
  templateUrl: './work-tasks-page.html'
})
export class WorkTasksPage {
  private auth = inject(AuthService);
  private service = inject(WorkTaskService);
  private lookups = inject(LookupsService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateWorkTask),
    edit: this.auth.hasPermission(AppPermission.EditWorkTask),
    delete: this.auth.hasPermission(AppPermission.DeleteWorkTask)
  }));

  icons = ICONS;
  label = roleLabel;
  Number = Number;

  branches = signal<Branch[]>([]);
  branchUsers = signal<User[]>([]);
  usersLoading = signal(false);
  selected = signal(new Set<number>());
  filterBranch = signal(0);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    icon: ['📋'],
    branchId: [0, Validators.min(1)],
    isActive: [true]
  });

  crud = new CrudPage<WorkTask, WorkTaskRequest>({
    load: () => this.service.getAll(),
    create: body => this.service.create(body),
    update: (id, body) => this.service.update(id, body),
    remove: t => this.service.delete(t.id),
    can: { create: () => this.can().create, edit: () => this.can().edit, delete: () => this.can().delete },
    onOpen: t => {
      this.form.reset({ name: t?.name ?? '', description: t?.description ?? '', icon: t?.icon || '📋', branchId: t?.branchId ?? 0, isActive: t?.isActive ?? true });
      this.selected.set(new Set(t?.assignees.map(a => a.userId) ?? []));
      this.branchChanged(true);
    },
    messages: {
      saved: 'تم حفظ المهمة', deleted: 'تم حذف المهمة', plural: 'مهام العمل',
      confirmDelete: t => `حذف المهمة «${t.name}»؟ ستُزال من لوحات كل الموظفين المسنَدة إليهم.`
    }
  });

  filtered = computed(() => {
    const b = this.filterBranch();
    return b ? this.crud.items().filter(t => t.branchId === b) : this.crud.items();
  });
  pager = new Pagination(() => this.filtered());

  constructor() {
    this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  assigneeNames(t: WorkTask) { return t.assignees.map(a => a.fullName).join('، '); }

  toggle(userId: number) {
    this.selected.update(set => {
      const next = new Set(set);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  // الموظفون المسنَدون يجب أن يكونوا من فرع المهمة — تغيير الفرع يلغي الاختيار
  branchChanged(keepSelection = false) {
    if (!keepSelection) this.selected.set(new Set());
    const branchId = Number(this.form.value.branchId);
    this.branchUsers.set([]);
    if (!branchId) return;
    this.usersLoading.set(true);
    this.userService.getByBranch(branchId).subscribe({
      next: users => { this.branchUsers.set(users.filter(u => u.isActive)); this.usersLoading.set(false); },
      error: e => { this.crud.fail(e.message); this.usersLoading.set(false); }
    });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: WorkTaskRequest = {
      name: v.name.trim(), description: v.description.trim(), icon: v.icon,
      branchId: Number(v.branchId), isActive: v.isActive, userIds: [...this.selected()]
    };
    if (!body.name) return this.crud.fail('أدخل اسم المهمة');
    this.crud.save(body);
  }
}
