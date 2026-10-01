import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { NotificationService } from '../../core/services/notification.service';
import { MaintenanceTask, TechnicianOption, nowLocalInput, toLocalInput, utcDate } from '../../core/models/maintenance.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { AssignDialog, Pager } from './maintenance-ui';

const PAGE_SIZE = 20;

/**
 * مهام الصيانة: الأعمال الميدانية التي ينفّذها موظفو القسم (المكان، الجهة الطالبة، المطلوب، المنجز).
 * كل موظف يرى مهامه، ورئيس القسم مهام قسمه وله نقلها لموظف آخر، ورئيس الفرع يطّلع فقط.
 */
@Component({
  selector: 'app-maintenance-tasks-page', standalone: true, imports: [DatePipe, ReactiveFormsModule, Modal, Pager, AssignDialog],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الصيانة</span><h1>مهام الصيانة</h1><p class="muted">الأعمال الميدانية: أين نُفّذت، لمن، وما المطلوب وما أُنجز</p></div>
        <div class="header-actions">
          @if (can().createTask) { <button class="btn" type="button" (click)="openForm(null)">+ مهمة جديدة</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (employees().length > 1) {
        <div class="filters-row">
          <select (change)="userId.set(+$any($event.target).value); page.set(1); load()" aria-label="الموظف">
            <option [value]="0" [selected]="!userId()">كل الموظفين</option>
            @for (u of employees(); track u.id) { <option [value]="u.id" [selected]="u.id === userId()">{{ u.fullName }}</option> }
          </select>
        </div>
      }

      <section class="panel">
        @if (loading() && !tasks().length) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!tasks().length) {
          <div class="empty-state"><h3>لا توجد مهام صيانة بعد</h3><p>سجّل المهمة عند تكليفك بعمل ميداني لتوثيق ما طُلب وما أُنجز.</p></div>
        } @else {
          <div class="table-wrap"><table>
            <thead><tr><th>المكان</th><th>الجهة الطالبة</th><th>الأعمال المطلوبة</th><th>الحالة</th><th>الموظف المكلَّف</th><th>تاريخ التسجيل</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (t of tasks(); track t.id) {
                <tr class="clickable" (click)="openForm(t)">
                  <td><span class="cell-strong">{{ t.taskLocation }}</span></td>
                  <td>{{ t.requestingParty }}</td>
                  <td class="wrap"><span class="clamp">{{ t.requiredWork }}</span></td>
                  <td><span class="status-badge" [class.status-active]="state(t) === 'done'" [class.status-pending]="state(t) === 'running'" [class.status-draft]="state(t) === 'new'">{{ stateLabel[state(t)] }}</span></td>
                  <td>{{ t.userName }}</td>
                  <td class="nowrap">{{ utc(t.createdAt) | date:'yyyy/MM/dd' }}</td>
                  <td (click)="$event.stopPropagation()"><div class="row-actions">
                    @if (can().assignTask && t.canAssign) { <button class="btn btn-ghost btn-sm" type="button" (click)="assigning.set(t)">نقل</button> }
                    @if (can().deleteTask && t.canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(t)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="page.set($event); load()" />
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-modal [heading]="!editing() ? 'مهمة صيانة جديدة' : readOnly() ? 'تفاصيل المهمة' : 'تعديل المهمة'"
                 [subheading]="editing() ? 'الموظف: ' + editing()!.userName : ''" size="lg" [busy]="saving()" (closed)="closeForm()">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body form-grid-2">
            @if (formError()) { <p class="alert alert-error full" role="alert">{{ formError() }}</p> }
            @if (canPickEmployee()) {
              <label class="form-field full"><span class="form-label">الموظف المكلَّف بالمهمة</span>
                <select formControlName="assigneeId">
                  @if (!editing()) { <option [ngValue]="0">أنا (المهمة لي)</option> }
                  @for (u of employees(); track u.id) { <option [ngValue]="u.id">{{ u.fullName }}</option> }
                </select>
                <small class="hint">يصل إشعار للموظف عند توجيه المهمة إليه</small></label>
            }
            <label class="form-field"><span class="form-label">مكان المهمة</span><input formControlName="taskLocation" maxlength="200"></label>
            <label class="form-field"><span class="form-label">الجهة الطالبة</span><input formControlName="requestingParty" maxlength="200"></label>
            <label class="form-field full"><span class="form-label">الأعمال المطلوبة</span><textarea formControlName="requiredWork" rows="3" maxlength="2000"></textarea></label>
            <label class="form-field full"><span class="form-label">الأعمال المنجزة <small class="hint">(تُملأ بعد التنفيذ)</small></span><textarea formControlName="completedWorks" rows="3" maxlength="2000"></textarea></label>
            <label class="form-field"><span class="form-label">تاريخ البدء <small class="hint">(اختياري)</small></span>
              <span class="with-btn"><input type="datetime-local" formControlName="startedAt">@if (!readOnly()) { <button type="button" class="btn btn-ghost btn-sm" (click)="setNow('startedAt')">الآن</button> }</span></label>
            <label class="form-field"><span class="form-label">تاريخ الإنجاز <small class="hint">(اختياري)</small></span>
              <span class="with-btn"><input type="datetime-local" formControlName="completedAt" [min]="form.controls.startedAt.value">@if (!readOnly()) { <button type="button" class="btn btn-ghost btn-sm" (click)="setNow('completedAt')">الآن</button> }</span>
              @if (dateError()) { <small class="form-error">تاريخ الإنجاز لا يسبق تاريخ البدء</small> }</label>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">{{ readOnly() ? 'إغلاق' : 'إلغاء' }}</button>
            @if (!readOnly()) { <button type="submit" [disabled]="form.invalid || dateError() || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button> }
          </footer>
        </form>
      </app-modal>
    }

    @if (assigning(); as t) {
      <app-assign-dialog [subject]="t.taskLocation + ' — ' + t.requestingParty" [currentUserId]="t.userId" [departmentId]="t.departmentId"
                         [busy]="saving()" (assign)="assign(t, $event)" (closed)="assigning.set(null)" />
    }`,
  styles: [`
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .with-btn { display: flex; gap: 8px; align-items: center; }
    .with-btn input { flex: 1; min-width: 0; }
  `]
})
export class MaintenanceTasksPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  can = this.service.can;
  utc = utcDate;
  pageSize = PAGE_SIZE;
  stateLabel = { new: 'لم تبدأ', running: 'قيد التنفيذ', done: 'منجزة' } as const;

  tasks = signal<MaintenanceTask[]>([]);
  total = signal(0);
  page = signal(1);
  userId = signal(0);
  employees = signal<TechnicianOption[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formError = signal('');
  formOpen = signal(false);
  editing = signal<MaintenanceTask | null>(null);
  readOnly = signal(false);
  assigning = signal<MaintenanceTask | null>(null);

  /** مهمة مطلوب فتحها من رابط إشعار (?task=) بعد أول تحميل */
  private openId = 0;

  form = inject(FormBuilder).nonNullable.group({
    assigneeId: [0],
    taskLocation: ['', [Validators.required, Validators.maxLength(200)]],
    requestingParty: ['', [Validators.required, Validators.maxLength(200)]],
    requiredWork: ['', [Validators.required, Validators.maxLength(2000)]],
    completedWorks: ['', Validators.maxLength(2000)],
    startedAt: [''],
    completedAt: ['']
  });

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.openId = Number(p.get('task')) || 0;
      this.openFromLink();
    });

    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MaintenanceTask') this.load();
    });

    // قائمة الموظفين للتصفية (رئيس القسم والسوبر ادمن فقط — فارغة لغيرهم)
    this.service.assignees().subscribe({ next: list => this.employees.set(list), error: () => { } });
    this.load();
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.tasks({ userId: this.userId(), page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: r => { this.tasks.set(r.items); this.total.set(r.totalCount); this.loading.set(false); this.openFromLink(); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  private openFromLink() {
    const task = this.openId ? this.tasks().find(t => t.id === this.openId) : null;
    if (task) { this.openId = 0; this.openForm(task); }
  }

  state(t: MaintenanceTask): 'new' | 'running' | 'done' {
    return t.completedAt ? 'done' : t.startedAt ? 'running' : 'new';
  }

  openForm(t: MaintenanceTask | null) {
    const readOnly = !!t && !(this.can().editTask && t.canEdit);
    this.editing.set(t); this.readOnly.set(readOnly); this.formError.set('');
    this.form.reset({
      assigneeId: t?.userId ?? 0,
      taskLocation: t?.taskLocation ?? '', requestingParty: t?.requestingParty ?? '',
      requiredWork: t?.requiredWork ?? '', completedWorks: t?.completedWorks ?? '',
      startedAt: toLocalInput(t?.startedAt), completedAt: toLocalInput(t?.completedAt)
    });
    readOnly ? this.form.disable() : this.form.enable();
    this.formOpen.set(true);
  }

  /**
   * حقل الموظف يظهر لمن يستطيع توجيه المهام (رئيس القسم / السوبر ادمن — القائمة فارغة لغيرهما):
   * عند الإنشاء دائماً، وعند التعديل إن كان يملك نقل هذه المهمة.
   */
  canPickEmployee() {
    const t = this.editing();
    return this.employees().length > 0 && !this.readOnly() && (!t || (t.canAssign && this.employees().some(u => u.id === t.userId)));
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }

  dateError() {
    const { startedAt, completedAt } = this.form.getRawValue();
    return !!startedAt && !!completedAt && completedAt < startedAt;
  }

  setNow(control: 'startedAt' | 'completedAt') {
    this.form.controls[control].setValue(nowLocalInput());
  }

  save() {
    if (this.readOnly() || this.form.invalid || this.dateError() || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      taskLocation: v.taskLocation.trim(), requestingParty: v.requestingParty.trim(),
      requiredWork: v.requiredWork.trim(), completedWorks: v.completedWorks.trim(),
      startedAt: v.startedAt || null, completedAt: v.completedAt || null
    };
    const t = this.editing();
    const assigneeId = this.canPickEmployee() ? Number(v.assigneeId) : 0;
    // عند التعديل: تغيير الموظف = نقل المهمة (بعد حفظ باقي الحقول)
    const request$ = !t ? this.service.createTask({ ...body, assigneeId: assigneeId || null })
      : assigneeId && assigneeId !== t.userId
        ? this.service.updateTask(t.id, body).pipe(switchMap(() => this.service.assignTask(t.id, assigneeId)))
        : this.service.updateTask(t.id, body);

    this.saving.set(true); this.formError.set('');
    request$.subscribe({
      next: saved => {
        this.saving.set(false); this.formOpen.set(false);
        this.toast.success(t ? 'تم حفظ التعديلات' : assigneeId ? `تم توجيه المهمة إلى ${saved.userName}` : 'تم تسجيل المهمة');
        this.load();
      },
      error: e => { this.saving.set(false); this.formError.set(e.message); this.load(); }
    });
  }

  assign(t: MaintenanceTask, userId: number) {
    this.saving.set(true);
    this.service.assignTask(t.id, userId).subscribe({
      next: updated => { this.saving.set(false); this.assigning.set(null); this.toast.success(`نُقلت المهمة إلى ${updated.userName}`); this.load(); },
      error: e => { this.saving.set(false); this.toast.error(e.message); }
    });
  }

  async askDelete(t: MaintenanceTask) {
    if (!await this.confirm.ask(`حذف مهمة الصيانة في «${t.taskLocation}»؟`, 'حذف')) return;
    this.service.deleteTask(t.id).subscribe({
      next: () => { this.toast.success('تم حذف المهمة'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }
}
