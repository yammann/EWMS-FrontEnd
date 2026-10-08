import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkTaskService } from '../data-access/work-task.service';
import { LookupsService } from '@core/services/lookups.service';
import { UserService } from '@features/users';
import { Branch, User } from '@core/models/ewms.models';
import { WorkTask } from '../data-access/work-task.models';
import { roleLabel } from '@core/utils/roles';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';

const ICONS = ['📋', '📦', '🧾', '📊', '🛠️', '💻', '🚚', '🔧', '📁', '🧮', '🗂️', '📞'];

/** إدارة مهام العمل لكل فرع وإسنادها لموظفيه (ManageWorkTasks — السوبر ادمن) */
@Component({
  selector: 'app-work-tasks-page', standalone: true, imports: [PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager],
  styleUrls: ['../../../shared/styles/page-base.scss', './work-tasks-page.scss'],
  templateUrl: './work-tasks-page.html',
  
})
export class WorkTasksPage {
  pager = new Pagination(() => this.filtered());
  private auth = inject(AuthService);
  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والنموذج والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateWorkTask),
    edit: this.auth.hasPermission(AppPermission.EditWorkTask),
    delete: this.auth.hasPermission(AppPermission.DeleteWorkTask)
  }));
  private service = inject(WorkTaskService);
  private lookups = inject(LookupsService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  icons = ICONS;
  label = roleLabel;
  Number = Number;

  tasks = signal<WorkTask[]>([]);
  branches = signal<Branch[]>([]);
  branchUsers = signal<User[]>([]);
  selected = signal(new Set<number>());
  filterBranch = signal(0);
  editing = signal<number | null>(null);
  deleting = signal<WorkTask | null>(null);
  loading = signal(false); usersLoading = signal(false); saving = signal(false);
  error = signal(''); success = signal('');

  filtered = computed(() => {
    const b = this.filterBranch();
    return b ? this.tasks().filter(t => t.branchId === b) : this.tasks();
  });

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    icon: ['📋'],
    branchId: [0, Validators.min(1)],
    isActive: [true]
  });

  constructor() {
    this.load();
    this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
  }

  load() {
    trackRequest(this.service.getAll(), this.loading, this.error, t => { this.tasks.set(t); });
  }

  assigneeNames(t: WorkTask) { return t.assignees.map(a => a.fullName).join('، '); }

  toggle(userId: number) {
    this.selected.update(set => {
      const next = new Set(set);
      next.has(userId) ? next.delete(userId) : next.add(userId);
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
      error: e => { this.error.set(e.message); this.usersLoading.set(false); }
    });
  }

  edit(t: WorkTask) {
    this.editing.set(t.id); this.deleting.set(null); this.success.set('');
    this.form.setValue({ name: t.name, description: t.description, icon: t.icon || '📋', branchId: t.branchId, isActive: t.isActive });
    this.selected.set(new Set(t.assignees.map(a => a.userId)));
    this.branchChanged(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reset() {
    this.editing.set(null);
    this.form.reset({ name: '', description: '', icon: '📋', branchId: 0, isActive: true });
    this.selected.set(new Set()); this.branchUsers.set([]);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(), description: v.description.trim(), icon: v.icon,
      branchId: Number(v.branchId), isActive: v.isActive,
      userIds: [...this.selected()]
    };
    if (!body.name) { this.error.set('أدخل اسم المهمة'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    const id = this.editing();
    (id ? this.service.update(id, body) : this.service.create(body)).subscribe({
      next: () => { this.saving.set(false); this.success.set('تم حفظ المهمة'); this.reset(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }

  remove(t: WorkTask) {
    if (this.saving()) return;
    this.success.set('');
    trackRequest(this.service.delete(t.id), this.saving, this.error, () => { this.deleting.set(null); if (this.editing() === t.id) this.reset(); this.success.set('تم حذف المهمة'); this.load(); });
  }
}
