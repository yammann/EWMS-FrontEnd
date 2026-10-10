import { DatePipe } from '@angular/common';
import { RowActions } from '@shared/ui/row-actions';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceTask, TechnicianOption, nowLocalInput, toLocalInput } from '../data-access/maintenance.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { AssignDialog } from '../components/maintenance-ui';
import { Pager } from '@shared/ui/pager';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { latestRequest } from '@shared/ui/track-request';

const PAGE_SIZE = 20;

/**
 * مهام الصيانة: الأعمال الميدانية التي ينفّذها موظفو القسم (المكان، الجهة الطالبة، المطلوب، المنجز).
 * كل موظف يرى مهامه، ورئيس القسم مهام قسمه وله نقلها لموظف آخر، ورئيس الفرع يطّلع فقط.
 */
@Component({
  selector: 'app-maintenance-tasks-page', standalone: true, imports: [RowActions, PageHeader, EmptyState, Alert, UtcPipe, DatePipe, ReactiveFormsModule, Modal, Pager, AssignDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './tasks-page.html',
  styles: [`
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .with-btn { display: flex; gap: 8px; align-items: center; }
    .with-btn input { flex: 1; min-width: 0; }
  `]
})
export class MaintenanceTasksPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  /** السجل الجاري حذفه (مؤشر على صفه) */
  deletingId = signal<number | null>(null);
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  can = this.service.can;
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
    this.latest(this.service.tasks({ userId: this.userId(), page: this.page(), pageSize: PAGE_SIZE }), this.loading, this.error, r => { this.tasks.set(r.items); this.total.set(r.totalCount); this.openFromLink(); });
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
    this.deletingId.set(t.id);
    this.service.deleteTask(t.id).subscribe({
      next: () => { this.deletingId.set(null); this.toast.success('تم حذف المهمة'); this.load(); },
      error: e => { this.deletingId.set(null); this.toast.error(e.message); }
    });
  }
}
