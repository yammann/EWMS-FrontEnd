import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkTaskService } from '@core/services/work-task.service';
import { EwmsService } from '@core/services/ewms.service';
import { Branch, User } from '@core/models/ewms.models';
import { WorkTask } from '@core/models/work-task.models';
import { roleLabel } from '@core/utils/roles';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

const ICONS = ['📋', '📦', '🧾', '📊', '🛠️', '💻', '🚚', '🔧', '📁', '🧮', '🗂️', '📞'];

/** إدارة مهام العمل لكل فرع وإسنادها لموظفيه (ManageWorkTasks — السوبر ادمن) */
@Component({
  selector: 'app-work-tasks-page', standalone: true, imports: [PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <app-page-header eyebrow="الإدارة" heading="مهام العمل" subtitle="المهام الدورية لكل فرع (مثل إدارة المخزن) ومن المسؤول عنها. تظهر كبطاقات في لوحات المتابعة.">
        <button class="btn btn-ghost" (click)="load()" [disabled]="loading() || saving()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" />
      @if (success()) { <p class="alert alert-success" role="status">{{ success() }}</p> }

      @if (editing() ? can().edit : can().create) {
      <section class="panel">
        <div class="panel-heading"><h2>{{ editing() ? 'تعديل المهمة' : 'إضافة مهمة' }}</h2></div>
        <form [formGroup]="form" (ngSubmit)="save()" class="form-grid">
          <label class="form-field">اسم المهمة<input formControlName="name" maxlength="100" placeholder="مثال: إدارة المخزن"></label>
          <label class="form-field">الفرع
            <select formControlName="branchId" (change)="branchChanged()">
              <option [value]="0">اختر الفرع</option>
              @for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          </label>
          <label class="form-field">الحالة
            <select formControlName="isActive"><option [ngValue]="true">فعّالة</option><option [ngValue]="false">معطّلة (لا تظهر كبطاقة)</option></select>
          </label>
          <label class="form-field full-width">الوصف<input formControlName="description" maxlength="500" placeholder="مثال: الإدخال والإخراج والتقارير"></label>

          <fieldset class="full-width icon-picker">
            <legend class="form-label">الأيقونة</legend>
            @for (icon of icons; track icon) {
              <button type="button" class="icon-option" [class.selected]="form.value.icon === icon" (click)="form.patchValue({ icon })" [attr.aria-label]="'اختيار الأيقونة ' + icon" [attr.aria-pressed]="form.value.icon === icon">{{ icon }}</button>
            }
          </fieldset>

          <fieldset class="full-width assignees">
            <legend class="form-label">الموظفون المسؤولون ({{ selected().size }})</legend>
            @if (!Number(form.value.branchId)) { <p class="muted">اختر الفرع أولاً لعرض موظفيه.</p> }
            @else if (usersLoading()) { <p class="muted">جارٍ تحميل موظفي الفرع…</p> }
            @else if (!branchUsers().length) { <p class="muted">لا يوجد موظفون في هذا الفرع.</p> }
            @else {
              <div class="user-grid">
                @for (u of branchUsers(); track u.id) {
                  <label class="user-option" [class.checked]="selected().has(u.id)">
                    <input type="checkbox" [checked]="selected().has(u.id)" (change)="toggle(u.id)">
                    <span><strong>{{ u.fullName }}</strong><small>{{ label(u.roleName) }}@if (u.departmentName) { · {{ u.departmentName }} }@if (u.officeName) { / {{ u.officeName }} }</small></span>
                  </label>
                }
              </div>
            }
          </fieldset>

          <div class="actions full-width">
            <button class="btn" type="submit" [disabled]="form.invalid || saving() || !Number(form.value.branchId)">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ المهمة' }}</button>
            @if (editing()) { <button class="btn btn-ghost" type="button" (click)="reset()" [disabled]="saving()">إلغاء التعديل</button> }
          </div>
        </form>
      </section>
      }

      <section class="panel">
        <div class="panel-heading">
          <h2>المهام ({{ filtered().length }})</h2>
          <select [value]="filterBranch()" (change)="filterBranch.set(+$any($event.target).value)" aria-label="تصفية حسب الفرع">
            <option [value]="0">كل الفروع</option>
            @for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
          </select>
        </div>
        @if (loading()) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!filtered().length) { <app-empty-state>لا توجد مهام بعد. أضف مهمة واختر فرعها والموظفين المسؤولين.</app-empty-state> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>المهمة</th><th>الفرع</th><th>الحالة</th><th>المسؤولون</th><th>الإجراءات</th></tr></thead>
            <tbody>
              @for (t of pager.items(); track t.id) {
                <tr>
                  <td><strong><span aria-hidden="true">{{ t.icon }}</span> {{ t.name }}</strong>@if (t.description) { <small>{{ t.description }}</small> }</td>
                  <td>{{ t.branchName }}</td>
                  <td><span class="status-badge" [class.status-active]="t.isActive" [class.status-draft]="!t.isActive"><span class="status-badge-dot"></span>{{ t.isActive ? 'فعّالة' : 'معطّلة' }}</span></td>
                  <td class="wrap">{{ assigneeNames(t) || '—' }}</td>
                  <td><div class="actions">@if (can().edit) { <button class="btn btn-ghost btn-sm" (click)="edit(t)" [disabled]="saving()">تعديل</button> }@if (can().delete) { <button class="btn btn-danger btn-sm" (click)="deleting.set(t)" [disabled]="saving()">حذف</button> }</div></td>
                </tr>
              }
            </tbody>
          </table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
        @if (deleting(); as t) {
          <div class="alert alert-warning"><span>حذف المهمة «{{ t.name }}»؟ ستُزال من لوحات كل الموظفين المسنَدة إليهم.</span>
            <button class="btn btn-danger" (click)="remove(t)" [disabled]="saving()">تأكيد الحذف</button>
            <button class="btn btn-ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button></div>
        }
      </section>
    </div>`,
  styles: [`
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    .icon-picker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .icon-picker legend { margin-bottom: 8px; }
    .icon-option { min-height: 40px; width: 44px; padding: 0; font-size: 20px; background: var(--surface); border: 1px solid var(--border); color: inherit; }
    .icon-option:hover:not(:disabled) { background: var(--brand-50); box-shadow: none; transform: none; }
    .icon-option.selected { border-color: var(--brand-600); background: var(--brand-50); box-shadow: 0 0 0 2px var(--brand-200); }
    .assignees legend { margin-bottom: 8px; }
    .user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; max-height: 320px; overflow-y: auto; padding: 2px; }
    .user-option { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; }
    .user-option.checked { border-color: var(--brand-500); background: var(--brand-50); }
    .user-option input { margin-top: 3px; }
    .user-option span { display: grid; gap: 2px; }
    .user-option strong { font-size: 13px; }
    .user-option small { font-size: 11px; color: var(--ink-500); }
  `]
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
  private ewms = inject(EwmsService);
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
    this.ewms.getBranchLookup().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.getAll().subscribe({
      next: t => { this.tasks.set(t); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
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
    this.ewms.getUsersByBranch(branchId).subscribe({
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
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.delete(t.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); if (this.editing() === t.id) this.reset(); this.success.set('تم حذف المهمة'); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
