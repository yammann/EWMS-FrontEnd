import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import {
  FREQUENCY_LABEL, SaveRecurrenceRequest, SaveTemplateRequest, TaskPriority, TaskRecurrence, TaskTargetKind, TaskTargetOption, TaskTemplate,
  TASK_PRIORITY_LABEL, TASK_PRIORITY_VALUE, WEEK_DAYS
} from '../data-access/assigned-task.models';
import { Modal } from '@shared/ui/modal';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { Alert } from '@shared/ui/alert';
import { PageHeader } from '@shared/ui/page-header';
import { FormActions } from '@shared/ui/form-actions';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TARGET_LABEL: Record<TaskTargetKind, string> = { Department: 'قسم', Office: 'مكتب', User: 'موظف' };

/** نافذة قالب: الاسم والعنوان والوصف والأولوية والمدة وبنود التحقق (بند في كل سطر) */
@Component({
  selector: 'app-template-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, Modal],
  template: `
    <app-modal [heading]="template() ? 'تعديل القالب' : 'قالب جديد'" size="lg" [busy]="saving()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">اسم القالب <small class="muted">(لك وحدك)</small></span>
            <input name="name" maxlength="100" [(ngModel)]="name" placeholder="مثال: جرد المستودع الشهري" autofocus></label>
          <label class="form-field"><span class="form-label">عنوان المهمة</span>
            <input name="title" maxlength="200" [(ngModel)]="title"></label>
          <label class="form-field"><span class="form-label">الوصف والتعليمات <small class="muted">(اختياري)</small></span>
            <textarea name="description" rows="4" maxlength="4000" [(ngModel)]="description"></textarea></label>
          <div class="two">
            <label class="form-field"><span class="form-label">الأولوية</span>
              <select name="priority" [(ngModel)]="priority">
                @for (p of priorities; track p) { <option [value]="p">{{ priorityLabel[p] }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">مدة التسليم <small class="muted">(أيام من الإنشاء، فارغ = بلا موعد)</small></span>
              <input name="days" type="number" min="0" max="365" [(ngModel)]="days"></label>
          </div>
          <label class="form-field"><span class="form-label">بنود التحقق <small class="muted">(بند في كل سطر، حتى 30)</small></span>
            <textarea name="items" rows="5" [(ngModel)]="items" placeholder="جرد الأصناف&#10;مطابقة السجلات&#10;رفع التقرير"></textarea></label>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="!name.trim() || !title.trim()" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>`,
  styles: [`.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }`]
})
export class TemplateDialog implements OnInit {
  private service = inject(AssignedTaskService);
  template = input<TaskTemplate | null>(null);
  saved = output<TaskTemplate>();
  closed = output<void>();

  priorities: TaskPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
  priorityLabel = TASK_PRIORITY_LABEL;
  name = ''; title = ''; description = ''; priority: TaskPriority = 'Normal'; days: number | null = null; items = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const t = this.template();
    if (t) { this.name = t.name; this.title = t.title; this.description = t.description; this.priority = t.priority; this.days = t.defaultDueDays; this.items = t.items.join('\n'); }
  }

  save() {
    if (this.saving()) return;
    const body: SaveTemplateRequest = {
      name: this.name.trim(), title: this.title.trim(), description: this.description.trim(),
      priority: TASK_PRIORITY_VALUE[this.priority], defaultDueDays: this.days === null || this.days === ('' as unknown) ? null : Number(this.days),
      items: this.items.split('\n').map(i => i.trim()).filter(Boolean)
    };
    this.saving.set(true); this.error.set('');
    const t = this.template();
    (t ? this.service.updateTemplate(t.id, body) : this.service.createTemplate(body)).subscribe({
      next: r => { this.saving.set(false); this.saved.emit(r); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}

/** نافذة مهمة دورية: قالب + جهة + جدول */
@Component({
  selector: 'app-recurrence-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, Modal],
  template: `
    <app-modal [heading]="recurrence() ? 'تعديل المهمة الدورية' : 'مهمة دورية جديدة'" size="lg" [busy]="saving()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">القالب</span>
            <select name="template" [(ngModel)]="templateId">
              <option [ngValue]="0">اختر قالباً</option>
              @for (t of templates(); track t.id) { <option [ngValue]="t.id">{{ t.name }} — {{ t.title }}</option> }
            </select>
            @if (!templates().length) { <small class="form-hint">أنشئ قالباً أولاً من قائمة القوالب.</small> }</label>

          @if (kinds().length > 1) {
            <label class="form-field"><span class="form-label">نوع الجهة</span>
              <select name="kind" [ngModel]="kind()" (ngModelChange)="chooseKind($event)">
                @for (k of kinds(); track k) { <option [value]="k">{{ targetLabel[k] }}</option> }
              </select></label>
          }
          <label class="form-field"><span class="form-label">إسناد إلى {{ targetLabel[kind()] }}</span>
            <select name="target" [(ngModel)]="targetId">
              <option [ngValue]="0">{{ loadingTargets() ? 'جارٍ التحميل…' : 'اختر ' + targetLabel[kind()] }}</option>
              @for (t of targets(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
            </select></label>

          <div class="two">
            <label class="form-field"><span class="form-label">التكرار</span>
              <select name="frequency" [(ngModel)]="frequency">
                <option [ngValue]="1">{{ freq[1] }}</option><option [ngValue]="2">{{ freq[2] }}</option><option [ngValue]="3">{{ freq[3] }}</option>
              </select></label>
            @if (frequency === 2) {
              <label class="form-field"><span class="form-label">يوم الأسبوع</span>
                <select name="dow" [(ngModel)]="dayOfWeek">@for (d of weekDays; track $index) { <option [ngValue]="$index">{{ d }}</option> }</select></label>
            } @else if (frequency === 3) {
              <label class="form-field"><span class="form-label">يوم الشهر <small class="muted">(31 = آخر يوم في الشهر القصير)</small></span>
                <input name="dom" type="number" min="1" max="31" [(ngModel)]="dayOfMonth"></label>
            }
          </div>
          <div class="two">
            <label class="form-field"><span class="form-label">البدء من</span><input name="start" type="date" [(ngModel)]="startDate"></label>
            <label class="form-field"><span class="form-label">الانتهاء <small class="muted">(اختياري)</small></span><input name="end" type="date" [(ngModel)]="endDate" [min]="startDate"></label>
          </div>
          <label class="form-field"><span class="form-label">مدة التسليم <small class="muted">(أيام من يوم الإنشاء — فارغ = مدة القالب)</small></span>
            <input name="due" type="number" min="0" max="365" [(ngModel)]="dueAfterDays"></label>
          <p class="note">تُنشأ المهمة تلقائياً بصلاحياتك وقت التنفيذ؛ إن فقدتَ الصلاحية أو حُذفت الجهة تتوقف المهمة الدورية ويصلك إشعار.</p>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="!templateId || !targetId" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>`,
  styles: [`
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
    .note { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 12px; color: var(--ink-600); }
  `]
})
export class RecurrenceDialog implements OnInit {
  private service = inject(AssignedTaskService);
  private auth = inject(AuthService);

  recurrence = input<TaskRecurrence | null>(null);
  templates = input<TaskTemplate[]>([]);
  saved = output<TaskRecurrence>();
  closed = output<void>();

  freq = FREQUENCY_LABEL;
  weekDays = WEEK_DAYS;
  targetLabel = TARGET_LABEL;
  kinds = computed<TaskTargetKind[]>(() => {
    const k: TaskTargetKind[] = [];
    if (this.auth.hasPermission(AppPermission.AssignTaskToDepartment)) k.push('Department');
    if (this.auth.hasPermission(AppPermission.AssignTaskToOffice)) k.push('Office');
    if (this.auth.hasPermission(AppPermission.AssignTaskToUser)) k.push('User');
    return k;
  });
  kind = signal<TaskTargetKind>('User');
  targets = signal<TaskTargetOption[]>([]);
  loadingTargets = signal(false);

  templateId = 0; targetId = 0; frequency = 1; dayOfWeek = 0; dayOfMonth = 1; dueAfterDays: number | null = null;
  startDate = iso(new Date()); endDate = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const r = this.recurrence();
    this.kind.set(r?.targetType ?? this.kinds()[0] ?? 'User');
    if (r) {
      this.templateId = r.templateId; this.frequency = r.frequency; this.dayOfWeek = r.dayOfWeek ?? 0; this.dayOfMonth = r.dayOfMonth ?? 1;
      this.dueAfterDays = r.dueAfterDays; this.startDate = r.startDate.slice(0, 10); this.endDate = r.endDate?.slice(0, 10) ?? '';
    }
    this.loadTargets(r?.targetId ?? 0);
  }

  chooseKind(kind: TaskTargetKind) { this.kind.set(kind); this.loadTargets(0); }

  private loadTargets(selected: number) {
    this.targets.set([]); this.targetId = 0; this.loadingTargets.set(true);
    this.service.targets({ type: this.kind() }).subscribe({
      next: list => { this.targets.set(list); this.targetId = list.some(t => t.id === selected) ? selected : 0; this.loadingTargets.set(false); },
      error: e => { this.error.set(e.message); this.loadingTargets.set(false); }
    });
  }

  save() {
    if (this.saving()) return;
    const body: SaveRecurrenceRequest = {
      templateId: Number(this.templateId), targetType: this.kind(), targetId: Number(this.targetId), frequency: Number(this.frequency),
      dayOfWeek: this.frequency === 2 ? Number(this.dayOfWeek) : null, dayOfMonth: this.frequency === 3 ? Number(this.dayOfMonth) : null,
      dueAfterDays: this.dueAfterDays === null || this.dueAfterDays === ('' as unknown) ? null : Number(this.dueAfterDays),
      startDate: this.startDate, endDate: this.endDate || null
    };
    this.saving.set(true); this.error.set('');
    const r = this.recurrence();
    (r ? this.service.updateRecurrence(r.id, body) : this.service.createRecurrence(body)).subscribe({
      next: saved => { this.saving.set(false); this.saved.emit(saved); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}

/** القوالب والمهام الدورية لمن يملك صلاحية إسناد: قوالب خاصة به، وجدولة إنشاء مهام تلقائياً */
@Component({
  selector: 'app-recurring-tasks-page', standalone: true, imports: [PageHeader, Alert, DatePipe, TemplateDialog, RecurrenceDialog],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/devices.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="إدارة المهام" heading="المهام الدورية والقوالب" subtitle="القوالب خاصة بك. المهمة الدورية تُنشئ مهمة جديدة من قالب في كل موعد دون تدخل منك." />
      <app-alert [message]="error()" />

      <section class="panel">
        <div class="panel-heading row"><div><h2>المهام الدورية</h2></div>
          <button class="btn" type="button" (click)="editRecurrence.set(null); recurrenceOpen.set(true)" [disabled]="!templates().length">+ مهمة دورية</button></div>
        @if (!templates().length) { <p class="muted">أنشئ قالباً أولاً ثم جدولته كمهمة دورية.</p> }
        @else if (!recurrences().length) { <p class="muted">لا توجد مهام دورية بعد.</p> }
        @else {
          <ul class="cards">
            @for (r of recurrences(); track r.id) {
              <li class="card" [class.off]="!r.isActive">
                <div class="head">
                  <strong>{{ r.templateName }}</strong>
                  <span class="chip" [class.on]="r.isActive">{{ r.isActive ? 'نشطة' : 'متوقفة' }}</span>
                </div>
                <p class="line">{{ r.taskTitle }} ← {{ r.targetTypeAr }}: <strong>{{ r.targetName }}</strong></p>
                <p class="line">{{ r.scheduleAr }}@if (r.isActive && r.nextRunDate) { — القادمة: {{ r.nextRunDate | date:'yyyy/MM/dd' }} }
                  @if (r.endDate) { — حتى {{ r.endDate | date:'yyyy/MM/dd' }} }</p>
                @if (r.lastRunAt) { <p class="line muted">آخر إنشاء: {{ r.lastRunAt | date:'yyyy/MM/dd HH:mm' }}
                  @if (r.lastTaskId) { — <a href="javascript:void 0" (click)="openTask(r.lastTaskId)">فتح المهمة</a> }</p> }
                @if (r.lastError) { <p class="alert alert-error err" role="alert">توقفت: {{ r.lastError }}</p> }
                <div class="actions">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="toggle(r)">{{ r.isActive ? 'إيقاف' : 'استئناف' }}</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="runNow(r)">إنشاء الآن</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editRecurrence.set(r); recurrenceOpen.set(true)">تعديل</button>
                  <button type="button" class="btn btn-danger btn-sm" (click)="removeRecurrence(r)">حذف</button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <section class="panel">
        <div class="panel-heading row"><div><h2>قوالبي</h2><p class="muted">تُستعمل عند إنشاء مهمة جديدة من نافذة «مهمة جديدة»، وفي المهام الدورية.</p></div>
          <button class="btn" type="button" (click)="editTemplate.set(null); templateOpen.set(true)">+ قالب</button></div>
        @if (!templates().length) { <p class="muted">لا توجد قوالب بعد.</p> }
        @else {
          <ul class="cards">
            @for (t of templates(); track t.id) {
              <li class="card">
                <div class="head"><strong>{{ t.name }}</strong><span class="chip">{{ t.priorityAr }}</span></div>
                <p class="line">{{ t.title }}</p>
                <p class="line muted">@if (t.defaultDueDays !== null) { تسليم بعد {{ t.defaultDueDays }} يوم · } {{ t.items.length }} بند تحقق</p>
                <div class="actions">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editTemplate.set(t); templateOpen.set(true)">تعديل</button>
                  <button type="button" class="btn btn-danger btn-sm" (click)="removeTemplate(t)">حذف</button>
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>

    @if (templateOpen()) { <app-template-dialog [template]="editTemplate()" (saved)="templateSaved()" (closed)="templateOpen.set(false)" /> }
    @if (recurrenceOpen()) { <app-recurrence-dialog [recurrence]="editRecurrence()" [templates]="templates()" (saved)="recurrenceSaved()" (closed)="recurrenceOpen.set(false)" /> }`,
  styles: [`
    .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
    .card { display: grid; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
    .card.off { opacity: .8; background: var(--ink-50); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .line { margin: 0; font-size: 13px; color: var(--ink-700); }
    .chip { padding: 2px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 800; background: var(--ink-100); color: var(--ink-600); }
    .chip.on { background: var(--brand-50); color: var(--brand-700); }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; }
    .err { margin: 4px 0 0; font-size: 12px; }
  `]
})
export class RecurringTasksPage {
  private service = inject(AssignedTaskService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  templates = signal<TaskTemplate[]>([]);
  recurrences = signal<TaskRecurrence[]>([]);
  error = signal('');
  templateOpen = signal(false); editTemplate = signal<TaskTemplate | null>(null);
  recurrenceOpen = signal(false); editRecurrence = signal<TaskRecurrence | null>(null);

  constructor() { this.load(); }

  load() {
    this.service.templates().subscribe({ next: t => this.templates.set(t), error: e => this.error.set(e.message) });
    this.service.recurrences().subscribe({ next: r => this.recurrences.set(r), error: e => this.error.set(e.message) });
  }

  templateSaved() { this.templateOpen.set(false); this.toast.success('تم حفظ القالب'); this.load(); }
  recurrenceSaved() { this.recurrenceOpen.set(false); this.toast.success('تم حفظ المهمة الدورية'); this.load(); }
  openTask(id: number) { this.router.navigateByUrl(`/task-board?task=${id}`); }

  toggle(r: TaskRecurrence) {
    this.service.setRecurrenceActive(r.id, !r.isActive).subscribe({
      next: () => { this.toast.success(r.isActive ? 'أُوقفت المهمة الدورية' : 'استُؤنفت المهمة الدورية'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }

  async runNow(r: TaskRecurrence) {
    if (!(await this.confirm.ask(`إنشاء مهمة الآن من «${r.templateName}» وإسنادها إلى ${r.targetName}؟ لا يتغير موعدها القادم.`, 'إنشاء'))) return;
    this.service.runRecurrenceNow(r.id).subscribe({
      next: t => { this.toast.success(`أُنشئت «${t.title}»`); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }

  async removeRecurrence(r: TaskRecurrence) {
    if (!(await this.confirm.ask(`حذف المهمة الدورية «${r.templateName}»؟ لا تُحذف المهام التي أنشأتها.`, 'حذف'))) return;
    this.service.deleteRecurrence(r.id).subscribe({ next: () => { this.toast.success('تم الحذف'); this.load(); }, error: e => this.toast.error(e.message) });
  }

  async removeTemplate(t: TaskTemplate) {
    if (!(await this.confirm.ask(`حذف القالب «${t.name}»؟`, 'حذف'))) return;
    this.service.deleteTemplate(t.id).subscribe({ next: () => { this.toast.success('تم الحذف'); this.load(); }, error: e => this.toast.error(e.message) });
  }
}
