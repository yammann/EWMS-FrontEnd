import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Project } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';
import {
  DELAY_JUSTIFIED, DELAY_REJECTED, DELAY_UNJUSTIFIED, DelayInput, JustifyInput, ScheduleDelay, ScheduleTask, TASK_COMPLETED, dateOnly
} from '../data-access/schedule.models';
import { ScheduleService } from '../data-access/schedule.service';
import { ScheduleDecisionDialog, VersionChoice, projectVersionChoices } from './schedule-shared';

const STYLE = '../../../shared/styles/data-tools.scss';
const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

/** البنود المتأثرة: مربعات اختيار يدوية (يقترح النظام ولا يختار) */
function toggled(set: Set<number>, id: number, on: boolean) { const next = new Set(set); if (on) next.add(id); else next.delete(id); return next; }

/** تسجيل تأخير على بند معتمد لم يكتمل. غير المبرَّر يوثّق ملاحظة أو إجراءً، والمبرَّر يُرفع تبريره بعد التسجيل. لا يُسجَّل تلقائياً بمرور التاريخ. */
@Component({
  selector: 'app-record-delay-dialog', standalone: true, imports: [ReactiveFormsModule, Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal heading="تسجيل تأخير" subheading="يراجع المخوَّل حالة العمل ثم يسجّل" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">البند</span>
              <select #t [appSelectValue]="form.controls.taskId.value" (change)="form.controls.taskId.setValue(+t.value)">
                <option value="0">اختر البند</option>@for (x of candidates(); track x.id) { <option [value]="x.id">{{ x.name }} — ينتهي {{ end(x) }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">تاريخ اكتشاف التأخير</span><input type="date" formControlName="discoveredAt" [max]="today"></label>
          </div>
          <fieldset class="choices">
            <label><input type="radio" [checked]="form.controls.kind.value === unjustified" (change)="form.controls.kind.setValue(unjustified)"> غير مبرَّر</label>
            <label><input type="radio" [checked]="form.controls.kind.value === justified" (change)="form.controls.kind.setValue(justified)"> مبرَّر (يُرفع تبريره بعد التسجيل)</label>
          </fieldset>
          <label class="form-field"><span class="form-label">السبب / الملاحظة</span><textarea formControlName="reason" rows="2" maxlength="2000"></textarea></label>
          <label class="form-field"><span class="form-label">الإجراءات المتخذة</span><textarea formControlName="actions" rows="2" maxlength="2000"></textarea></label>
          @if (others().length) {
            <fieldset class="affected"><legend>بنود متأثرة (اختياري، تحددها أنت)</legend>
              @for (x of others(); track x.id) {
                <label><input type="checkbox" [checked]="picked().has(x.id)" (change)="pick(x.id, $any($event.target).checked)"> {{ x.name }}</label>
              }
            </fieldset>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'تسجيل التأخير' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.choices { display: flex; flex-wrap: wrap; gap: 18px; border: 0; padding: 0; margin: 0; } .choices label { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; }
    .affected { display: grid; gap: 6px; max-height: 180px; overflow: auto; border: 1px solid var(--ink-300); border-radius: var(--radius-md); padding: 10px 12px; } .affected label { display: flex; gap: 6px; }`]
})
export class RecordDelayDialog implements OnInit {
  tasks = input.required<readonly ScheduleTask[]>();
  preselected = input<ScheduleTask | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<{ taskId: number; input: DelayInput }>();
  closed = output<void>();
  problem = signal('');
  picked = signal<Set<number>>(new Set());
  today = todayIso();
  unjustified = DELAY_UNJUSTIFIED;
  justified = DELAY_JUSTIFIED;

  form = inject(FormBuilder).nonNullable.group({
    taskId: [0], kind: [DELAY_UNJUSTIFIED as number], discoveredAt: [todayIso(), Validators.required], reason: [''], actions: ['']
  });
  /** بنود لم تكتمل (المكتمل لا يُسجَّل عليه تأخير) */
  candidates = computed(() => this.tasks().filter(t => t.status !== TASK_COMPLETED));
  others = computed(() => this.tasks().filter(t => t.id !== this.form.controls.taskId.value));
  protected end = (t: ScheduleTask) => dateOnly(t.plannedEnd);

  ngOnInit() { const p = this.preselected(); if (p) this.form.controls.taskId.setValue(p.id); }
  pick(id: number, on: boolean) { this.picked.update(s => toggled(s, id, on)); }

  save() {
    const v = this.form.getRawValue();
    if (!v.taskId) { this.problem.set('اختر البند'); return; }
    if (!v.discoveredAt) { this.problem.set('تاريخ الاكتشاف مطلوب'); return; }
    if (v.kind === DELAY_UNJUSTIFIED && !v.reason.trim() && !v.actions.trim()) { this.problem.set('وثّق ملاحظة أو إجراءً متخذاً للتأخير غير المبرَّر'); return; }
    this.problem.set('');
    this.submitted.emit({ taskId: v.taskId, input: {
      kind: v.kind, discoveredAt: v.discoveredAt, reason: v.reason.trim(), actions: v.actions.trim(),
      affectedTaskIds: [...this.picked()].filter(id => id !== v.taskId)
    } });
  }
}

/** رفع تبرير التأخير للاعتماد: السبب والجهة الموافقة وتاريخها ومستند الموافقة من وثائق المشروع. الرفع لا يقبل التبرير؛ يعتمده غيرك. */
@Component({
  selector: 'app-justify-delay-dialog', standalone: true, imports: [ReactiveFormsModule, Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal heading="رفع تبرير التأخير" [subheading]="delay().taskName" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          @if (delay().decisionNote) { <p class="alert alert-warning" role="status">سبب الرفض السابق: {{ delay().decisionNote }}</p> }
          <label class="form-field"><span class="form-label">سبب التأخير</span><textarea formControlName="reason" rows="2" maxlength="2000"></textarea></label>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الجهة التي وافقت على التبرير</span><input formControlName="approvalAuthority" maxlength="200" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">تاريخ الموافقة</span><input type="date" formControlName="approvalDate" [max]="today"></label>
          </div>
          <label class="form-field"><span class="form-label">مستند الموافقة <small class="hint">(من وثائق المشروع)</small></span>
            <select #d [appSelectValue]="form.controls.documentId.value" (change)="form.controls.documentId.setValue(+d.value)">
              <option value="0">اختر المستند</option>@for (v of versions(); track v.id) { <option [value]="v.id">{{ v.label }}</option> }
            </select>
            @if (!versions().length) { <small class="hint">{{ canList() ? 'لا وثائق في المشروع بعد: ارفع مستند الموافقة من تبويب «الوثائق» أولاً.' : 'لا تملك صلاحية عرض وثائق المشروع لاختيار المستند.' }}</small> }
          </label>
          <label class="form-field"><span class="form-label">الإجراءات المتخذة</span><textarea formControlName="actions" rows="2" maxlength="2000"></textarea></label>
          <label class="check"><input type="checkbox" formControlName="affectsCriticalWork"> يؤثر على أعمال حرجة</label>
          @if (others().length) {
            <fieldset class="affected"><legend>البنود المتأثرة (تحددها أنت)</legend>
              @for (x of others(); track x.id) {
                <label><input type="checkbox" [checked]="picked().has(x.id)" (change)="pick(x.id, $any($event.target).checked)"> {{ x.name }}@if (suggested().has(x.id)) { <span class="pill">مقترح</span> }</label>
              }
            </fieldset>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الرفع…' : 'رفع للاعتماد' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.check { display: inline-flex; gap: 8px; align-items: center; font-weight: 700; }
    .affected { display: grid; gap: 6px; max-height: 180px; overflow: auto; border: 1px solid var(--ink-300); border-radius: var(--radius-md); padding: 10px 12px; } .affected label { display: flex; gap: 6px; align-items: center; }`]
})
export class JustifyDelayDialog implements OnInit {
  delay = input.required<ScheduleDelay>();
  tasks = input.required<readonly ScheduleTask[]>();
  versions = input<readonly VersionChoice[]>([]);
  canList = input(true);
  busy = input(false);
  error = input('');
  submitted = output<JustifyInput>();
  closed = output<void>();
  problem = signal('');
  picked = signal<Set<number>>(new Set());
  today = todayIso();

  form = inject(FormBuilder).nonNullable.group({
    reason: ['', Validators.required], approvalAuthority: ['', Validators.required], approvalDate: ['', Validators.required],
    documentId: [0], actions: [''], affectsCriticalWork: [false]
  });
  others = computed(() => this.tasks().filter(t => t.id !== this.delay().taskId));
  suggested = computed(() => new Set((this.delay().suggestedTasks ?? []).map(s => s.taskId)));

  ngOnInit() {
    const d = this.delay();
    this.form.reset({
      reason: d.reason, approvalAuthority: d.approvalAuthority, approvalDate: dateOnly(d.approvalDate), documentId: d.approvalDocumentVersionId ?? 0,
      actions: d.actions, affectsCriticalWork: d.affectsCriticalWork
    });
    this.picked.set(new Set(d.affectedTasks.map(a => a.taskId)));
  }
  pick(id: number, on: boolean) { this.picked.update(s => toggled(s, id, on)); }

  save() {
    const v = this.form.getRawValue();
    if (!v.reason.trim()) { this.problem.set('سبب التأخير مطلوب'); return; }
    if (!v.approvalAuthority.trim()) { this.problem.set('اذكر الجهة التي وافقت على التبرير'); return; }
    if (!v.approvalDate) { this.problem.set('تاريخ الموافقة مطلوب'); return; }
    if (!v.documentId) { this.problem.set('أرفق مستند الموافقة من وثائق المشروع'); return; }
    this.problem.set('');
    this.submitted.emit({
      reason: v.reason.trim(), actions: v.actions.trim(), approvalAuthority: v.approvalAuthority.trim(), approvalDate: v.approvalDate,
      approvalDocumentVersionId: v.documentId, affectsCriticalWork: v.affectsCriticalWork,
      affectedTaskIds: [...this.picked()], rowVersion: this.delay().rowVersion
    });
  }
}

/**
 * التأخيرات المسجَّلة على بنود الجدول المعتمد. من سجّل التأخير يرفع تبريره، وموظف آخر يعتمده أو يرفضه (بسبب)؛
 * التأخير المعتمد تبريره يُبنى عليه طلب تمديد من تبويب «التمديدات».
 */
@Component({
  selector: 'app-schedule-delays-panel', standalone: true,
  imports: [DatePipe, Alert, EmptyState, Modal, UtcPipe, RecordDelayDialog, JustifyDelayDialog, ScheduleDecisionDialog],
  styleUrl: STYLE,
  template: `
    <section class="panel">
      <div class="panel-heading">
        <h2>التأخيرات <span class="count">({{ delays().length }})</span></h2>
        @if (access().canRecordDelay && open() && tasks().length) { <button class="btn" type="button" (click)="startRecord()">+ تسجيل تأخير</button> }
      </div>
      <p class="muted">مرور تاريخ البند وحده لا يُنشئ تأخيراً: يراجع المخوَّل حالة العمل ثم يسجّل. التبرير يرفعه من سجّل التأخير ويعتمده غيره.</p>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (delays().length) {
        <div class="table-wrap"><table>
          <thead><tr><th>البند</th><th>النوع</th><th>الحالة</th><th>اكتُشف</th><th>أيام التأخر</th><th>سجّله</th><th class="actions-th"></th></tr></thead>
          <tbody>
            @for (d of delays(); track d.id) {
              <tr>
                <td class="cell-strong">{{ d.taskName }}</td>
                <td>{{ d.kindName }}</td>
                <td><span class="pill" [class.red]="d.status === rejected" [class.muted]="d.status === 5">{{ d.statusName }}</span></td>
                <td>{{ d.discoveredAt | date:'yyyy/MM/dd' }}</td>
                <td>{{ d.daysLate }}</td>
                <td>{{ d.recordedByName }}</td>
                <td class="row-buttons">
                  <button type="button" class="ghost" (click)="openDetail(d)">تفاصيل</button>
                  @if (d.canJustify) { <button type="button" class="ghost" (click)="openJustify(d)">{{ d.status === rejected ? 'إعادة رفع التبرير' : 'رفع التبرير' }}</button> }
                  @if (d.canDecide) { <button type="button" class="ghost" (click)="deciding.set(d)">قرار</button> }
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      } @else if (loading()) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else { <p class="muted">لا تأخيرات مسجَّلة.</p> }
    </section>

    @if (recording()) {
      <app-record-delay-dialog [tasks]="tasks()" [preselected]="recordTask()" [busy]="saving()" [error]="formError()"
        (submitted)="record($event)" (closed)="recording.set(false)" />
    }
    @if (justifying(); as d) {
      <app-justify-delay-dialog [delay]="d" [tasks]="tasks()" [versions]="versions()" [canList]="access().canListDocuments" [busy]="saving()" [error]="formError()"
        (submitted)="justify(d, $event)" (closed)="justifying.set(null)" />
    }
    @if (deciding(); as d) {
      <app-schedule-decision-dialog heading="قرار على تبرير التأخير" [subheading]="d.taskName" approveLabel="اعتماد التبرير" [busy]="saving()" [error]="formError()"
        (submitted)="decide(d, $event)" (closed)="deciding.set(null)">
        <dl class="facts">
          <div><dt>السبب</dt><dd>{{ d.reason }}</dd></div>
          <div><dt>الجهة الموافقة</dt><dd>{{ d.approvalAuthority }} · {{ d.approvalDate | date:'yyyy/MM/dd' }}</dd></div>
          <div><dt>المستند</dt><dd>{{ d.approvalDocumentTitle || '—' }}</dd></div>
        </dl>
      </app-schedule-decision-dialog>
    }
    @if (detail(); as d) {
      <app-modal [heading]="'تأخير: ' + d.taskName" [subheading]="d.kindName + ' · ' + d.statusName" size="lg" (closed)="detail.set(null)">
        <div class="modal-body form-stack">
          <dl class="facts">
            <div><dt>نهاية البند المخططة وقت التسجيل</dt><dd>{{ d.plannedEndAtDiscovery | date:'yyyy/MM/dd' }}</dd></div>
            <div><dt>تاريخ الاكتشاف</dt><dd>{{ d.discoveredAt | date:'yyyy/MM/dd' }} ({{ d.daysLate }} يوماً)</dd></div>
            <div><dt>سجّله</dt><dd>{{ d.recordedByName }} · {{ d.recordedAt | utc | date:'yyyy/MM/dd HH:mm' }}</dd></div>
            <div class="wide"><dt>السبب</dt><dd>{{ d.reason || '—' }}</dd></div>
            <div class="wide"><dt>الإجراءات المتخذة</dt><dd>{{ d.actions || '—' }}</dd></div>
            @if (d.approvalAuthority) { <div><dt>الجهة الموافقة</dt><dd>{{ d.approvalAuthority }} · {{ d.approvalDate | date:'yyyy/MM/dd' }}</dd></div> }
            @if (d.approvalDocumentTitle) { <div><dt>مستند الموافقة</dt><dd>{{ d.approvalDocumentTitle }}</dd></div> }
            @if (d.affectsCriticalWork) { <div><dt>الأثر</dt><dd>على أعمال حرجة</dd></div> }
            @if (d.decidedByName) { <div class="wide"><dt>القرار</dt><dd>{{ d.statusName }} — {{ d.decidedByName }} · {{ d.decidedAt | utc | date:'yyyy/MM/dd HH:mm' }}{{ d.decisionNote ? ' — ' + d.decisionNote : '' }}</dd></div> }
            <div class="wide"><dt>البنود المتأثرة</dt><dd>{{ names(d.affectedTasks) }}</dd></div>
            @if (d.suggestedTasks?.length) { <div class="wide"><dt>لواحق مقترحة للمراجعة (لم تُختر)</dt><dd>{{ names(d.suggestedTasks!) }}</dd></div> }
          </dl>
        </div>
        <footer class="modal-actions"><button type="button" (click)="detail.set(null)">إغلاق</button></footer>
      </app-modal>
    }`,
  styles: [`
    .muted { color: var(--ink-500); line-height: 1.8; margin: 0 0 8px; }
    .row-buttons { white-space: nowrap; } .row-buttons .ghost { min-height: 30px; padding: 0 8px; font-size: 12px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 22px; margin: 0; }
    .facts div { display: grid; gap: 4px; } .facts .wide { grid-column: 1 / -1; } .facts dt { color: var(--ink-500); font-size: 12px; } .facts dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
  `]
})
export class ScheduleDelaysPanel {
  private service = inject(ScheduleService);
  private projects = inject(ProjectsService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  project = input.required<Project>();
  /** بنود الجدول المعتمد */
  tasks = input<readonly ScheduleTask[]>([]);
  /** بند اختير من جدول البنود لتسجيل تأخير عليه: تُفتح النافذة ثم يُبلَّغ بالمعالجة */
  recordTask = input<ScheduleTask | null>(null);
  open = input(true);
  recordHandled = output<void>();
  changed = output<void>();

  access = this.service.access;
  rejected = DELAY_REJECTED;
  delays = signal<ScheduleDelay[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formError = signal('');
  recording = signal(false);
  justifying = signal<ScheduleDelay | null>(null);
  deciding = signal<ScheduleDelay | null>(null);
  detail = signal<ScheduleDelay | null>(null);
  versions = signal<VersionChoice[]>([]);

  constructor() {
    effect(() => { const id = this.project().id; untracked(() => this.load(id)); });
    effect(() => { if (this.recordTask()) { untracked(() => { this.formError.set(''); this.recording.set(true); }); } });
  }

  load(id = this.project().id) { this.latest(this.service.delays(id), this.loading, this.error, d => this.delays.set(d)); }

  startRecord() { this.formError.set(''); this.recording.set(true); }

  record(e: { taskId: number; input: DelayInput }) {
    trackRequest(this.service.recordDelay(e.taskId, e.input), this.saving, this.formError, () => {
      this.recording.set(false); this.recordHandled.emit(); this.toast.success('سُجّل التأخير'); this.load(); this.changed.emit();
    });
  }

  /** يجلب التأخير طازجاً (ومعه المقترحات) قبل فتحه */
  private fresh(d: ScheduleDelay, next: (fresh: ScheduleDelay) => void) {
    this.service.delay(d.id).subscribe({ next, error: e => this.error.set((e as { message?: string }).message ?? '') });
  }

  openDetail(d: ScheduleDelay) { this.fresh(d, f => this.detail.set(f)); }

  openJustify(d: ScheduleDelay) {
    this.formError.set('');
    if (this.access().canListDocuments) {
      projectVersionChoices(this.projects, d.projectId).subscribe({ next: v => this.versions.set(v), error: () => this.versions.set([]) });
    }
    this.fresh(d, f => this.justifying.set(f));
  }

  justify(d: ScheduleDelay, v: JustifyInput) {
    trackRequest(this.service.justifyDelay(d.id, v), this.saving, this.formError, () => {
      this.justifying.set(null); this.toast.success('رُفع التبرير للاعتماد'); this.load(); this.changed.emit();
    });
  }

  decide(d: ScheduleDelay, e: { approve: boolean; note: string }) {
    trackRequest(this.service.decideDelay(d.id, { approve: e.approve, note: e.note, rowVersion: d.rowVersion }), this.saving, this.formError, () => {
      this.deciding.set(null); this.toast.success(e.approve ? 'اعتُمد التبرير' : 'رُفض التبرير'); this.load(); this.changed.emit();
    });
  }

  names(list: { name: string }[]) { return list.length ? list.map(x => x.name).join('، ') : '—'; }
}
