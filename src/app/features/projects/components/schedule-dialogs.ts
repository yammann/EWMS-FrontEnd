import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ProjectMember } from '../data-access/projects.models';
import {
  ProgressEntry, ProgressInput, ScheduleDependency, ScheduleTask, StartOrder, StartOrderInput, TASK_COMPLETED, TASK_STATUSES, TaskInput, dateOnly
} from '../data-access/schedule.models';
import { ScheduleService } from '../data-access/schedule.service';

const STYLE = '../../../shared/styles/data-tools.scss';

/** أمر المباشرة: واحد لكل مشروع. مهندس الموقع ومشرف القطاع من مشاركي المشروع (يضيفهم من تبويب «المشاركون» أولاً). */
@Component({
  selector: 'app-start-order-dialog', standalone: true, imports: [ReactiveFormsModule, Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal [heading]="order() ? 'تعديل أمر المباشرة' : 'تسجيل أمر المباشرة'" subheading="منه يبدأ الجدول الزمني للمشروع" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">رقم الأمر</span><input formControlName="orderNumber" maxlength="50" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">تاريخ الأمر</span><input type="date" formControlName="orderDate"></label>
            <label class="form-field"><span class="form-label">تاريخ المباشرة</span><input type="date" formControlName="startDate"></label>
            <label class="form-field"><span class="form-label">مدة الإنجاز (يوماً)</span><input type="number" formControlName="completionDays" min="1" max="36500"></label>
            <label class="form-field"><span class="form-label">زمن التنفيذ (يوماً)</span><input type="number" formControlName="executionDays" min="1" max="36500"></label>
            <label class="form-field"><span class="form-label">تكلفة الدراسة <small class="hint">(اختياري)</small></span><input type="number" formControlName="studyCost" min="0" step="0.01"></label>
            <label class="form-field"><span class="form-label">مهندس الموقع</span>
              <select #e [appSelectValue]="form.controls.siteEngineerUserId.value" (change)="form.controls.siteEngineerUserId.setValue(+e.value)">
                <option value="0">—</option>@for (m of members(); track m.userId) { <option [value]="m.userId">{{ m.fullName }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">مشرف القطاع</span>
              <select #s [appSelectValue]="form.controls.sectorSupervisorUserId.value" (change)="form.controls.sectorSupervisorUserId.setValue(+s.value)">
                <option value="0">—</option>@for (m of members(); track m.userId) { <option [value]="m.userId">{{ m.fullName }}</option> }
              </select></label>
          </div>
          <label class="form-field"><span class="form-label">ملاحظات</span><textarea formControlName="notes" rows="3" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`
})
export class StartOrderDialog implements OnInit {
  order = input<StartOrder | null>(null);
  members = input<readonly ProjectMember[]>([]);
  busy = input(false);
  error = input('');
  submitted = output<StartOrderInput>();
  closed = output<void>();
  problem = signal('');

  form = inject(FormBuilder).nonNullable.group({
    orderNumber: ['', [Validators.required, Validators.maxLength(50)]], orderDate: ['', Validators.required], startDate: ['', Validators.required],
    completionDays: [180, [Validators.required, Validators.min(1), Validators.max(36500)]],
    executionDays: [180, [Validators.required, Validators.min(1), Validators.max(36500)]],
    studyCost: [null as number | null, Validators.min(0)], siteEngineerUserId: [0], sectorSupervisorUserId: [0], notes: ['']
  });

  ngOnInit() {
    const o = this.order();
    if (o) this.form.reset({
      orderNumber: o.orderNumber, orderDate: dateOnly(o.orderDate), startDate: dateOnly(o.startDate), completionDays: o.completionDays,
      executionDays: o.executionDays, studyCost: o.studyCost, siteEngineerUserId: o.siteEngineerUserId ?? 0,
      sectorSupervisorUserId: o.sectorSupervisorUserId ?? 0, notes: o.notes
    });
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid) { this.problem.set('أكمل الحقول المطلوبة بقيم صحيحة'); return; }
    if (v.startDate < v.orderDate) { this.problem.set('تاريخ المباشرة قبل تاريخ الأمر'); return; }
    this.problem.set('');
    this.submitted.emit({
      orderNumber: v.orderNumber.trim(), orderDate: v.orderDate, startDate: v.startDate, completionDays: v.completionDays, executionDays: v.executionDays,
      studyCost: v.studyCost, siteEngineerUserId: v.siteEngineerUserId || null, sectorSupervisorUserId: v.sectorSupervisorUserId || null,
      notes: v.notes.trim(), ...(this.order() ? { rowVersion: this.order()!.rowVersion } : {})
    });
  }
}

/** بند في المسودة. بند منقول من جدول معتمد تواريخه مثبّتة (تتغير بتمديد معتمد فقط)، والوزن يدوي (> 0) ونسبة المشروع متوسط مرجَّح به. */
@Component({
  selector: 'app-schedule-task-dialog', standalone: true, imports: [ReactiveFormsModule, Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal [heading]="task() ? 'تعديل البند' : 'بند جديد'" [subheading]="task()?.code || 'يدخل في نسبة المشروع بوزنه'" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">اسم البند</span><input formControlName="name" maxlength="300" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">الرمز <small class="hint">(اختياري، مثل 1.2)</small></span><input formControlName="code" maxlength="30" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">البداية</span><input type="date" formControlName="plannedStart"></label>
            <label class="form-field"><span class="form-label">النهاية</span><input type="date" formControlName="plannedEnd"></label>
            <label class="form-field"><span class="form-label">الوزن <small class="hint">(يدوي، أكبر من صفر)</small></span><input type="number" formControlName="weight" min="0.01" step="0.01"></label>
            <label class="form-field"><span class="form-label">المسؤول <small class="hint">(من المشاركين)</small></span>
              <select #a [appSelectValue]="form.controls.assigneeUserId.value" (change)="form.controls.assigneeUserId.setValue(+a.value)">
                <option value="0">—</option>@for (m of members(); track m.userId) { <option [value]="m.userId">{{ m.fullName }}</option> }
              </select></label>
          </div>
          @if (task()?.datesLocked) { <p class="alert alert-warning" role="status">تواريخ هذا البند مثبّتة من الجدول المعتمد، وتتغير بطلب تمديد معتمد فقط.</p> }
          <label class="form-field"><span class="form-label">ملاحظة</span><textarea formControlName="note" rows="2" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`
})
export class ScheduleTaskDialog implements OnInit {
  task = input<ScheduleTask | null>(null);
  members = input<readonly ProjectMember[]>([]);
  busy = input(false);
  error = input('');
  submitted = output<TaskInput>();
  closed = output<void>();
  problem = signal('');

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(300)]], code: [''], plannedStart: ['', Validators.required], plannedEnd: ['', Validators.required],
    weight: [1, [Validators.required, Validators.min(0.01)]], assigneeUserId: [0], note: ['']
  });

  ngOnInit() {
    const t = this.task();
    if (!t) return;
    this.form.reset({
      name: t.name, code: t.code, plannedStart: dateOnly(t.plannedStart), plannedEnd: dateOnly(t.plannedEnd), weight: t.weight,
      assigneeUserId: t.assigneeUserId ?? 0, note: t.note
    });
    if (t.datesLocked) { this.form.controls.plannedStart.disable(); this.form.controls.plannedEnd.disable(); }
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid) { this.problem.set('أكمل الحقول المطلوبة بقيم صحيحة'); return; }
    if (v.plannedEnd < v.plannedStart) { this.problem.set('نهاية البند قبل بدايته'); return; }
    this.problem.set('');
    this.submitted.emit({
      name: v.name.trim(), code: v.code.trim(), plannedStart: v.plannedStart, plannedEnd: v.plannedEnd, weight: v.weight, note: v.note.trim(),
      assigneeUserId: v.assigneeUserId || null, ...(this.task() ? { rowVersion: this.task()!.rowVersion } : {})
    });
  }
}

/** تبعيات المسودة «نهاية ← بداية»: لا يبدأ اللاحق قبل نهاية السابق. الحلقات والتكرار يرفضهما الخادم. */
@Component({
  selector: 'app-schedule-dependencies-dialog', standalone: true, imports: [Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal heading="تبعيات البنود" subheading="لا يبدأ اللاحق قبل نهاية السابق" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <div class="modal-body form-stack">
        <app-alert [message]="error()" />
        <div class="form-grid-2">
          <label class="form-field"><span class="form-label">السابق (ينتهي أولاً)</span>
            <select #p [appSelectValue]="predecessor()" (change)="predecessor.set(+p.value)">
              <option value="0">اختر البند</option>@for (t of tasks(); track t.id) { <option [value]="t.id">{{ label(t) }}</option> }
            </select></label>
          <label class="form-field"><span class="form-label">اللاحق (يبدأ بعده)</span>
            <select #s [appSelectValue]="successor()" (change)="successor.set(+s.value)">
              <option value="0">اختر البند</option>@for (t of tasks(); track t.id) { <option [value]="t.id">{{ label(t) }}</option> }
            </select></label>
        </div>
        <div><button type="button" class="btn" [disabled]="busy() || !predecessor() || !successor() || predecessor() === successor()" (click)="add()">+ إضافة تبعية</button></div>
        @if (dependencies().length) {
          <ul class="dep-list">
            @for (d of dependencies(); track d.id) {
              <li><span>{{ name(d.predecessorId) }} ← {{ name(d.successorId) }} @if (d.hasConflict) { <span class="pill red">تعارض زمني</span> }</span>
                <button type="button" class="ghost" [disabled]="busy()" (click)="remove.emit(d.id)">حذف</button></li>
            }
          </ul>
        } @else { <p class="muted">لا تبعيات بعد.</p> }
      </div>
      <footer class="modal-actions"><button type="button" (click)="closed.emit()">تم</button></footer>
    </app-modal>`,
  styles: [`.dep-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; } .dep-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); background: var(--fill); }`]
})
export class ScheduleDependenciesDialog {
  tasks = input.required<readonly ScheduleTask[]>();
  dependencies = input.required<readonly ScheduleDependency[]>();
  busy = input(false);
  error = input('');
  added = output<{ predecessorId: number; successorId: number }>();
  remove = output<number>();
  closed = output<void>();
  predecessor = signal(0);
  successor = signal(0);

  protected label = (t: ScheduleTask) => (t.code ? `${t.code} — ${t.name}` : t.name);
  protected name = (id: number) => { const t = this.tasks().find(x => x.id === id); return t ? this.label(t) : '—'; };

  add() {
    this.added.emit({ predecessorId: this.predecessor(), successorId: this.successor() });
    this.predecessor.set(0); this.successor.set(0);
  }
}

/** تحديث حالة بند معتمد ونسبته: التواريخ الفعلية تُكمَّل من الحالة، وخفض النسبة يحتاج ملاحظة، وكل تحديث يُسجَّل. */
@Component({
  selector: 'app-schedule-progress-dialog', standalone: true, imports: [DatePipe, ReactiveFormsModule, Modal, Alert, SelectValue, UtcPipe], styleUrl: STYLE,
  template: `
    <app-modal heading="تحديث الإنجاز" [subheading]="task().name" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الحالة</span>
              <select #s [appSelectValue]="form.controls.status.value" (change)="statusChanged(+s.value)">
                @for (x of statuses; track x.value) { <option [value]="x.value">{{ x.label }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">نسبة الإنجاز: {{ form.controls.progress.value }}%</span>
              <input type="range" formControlName="progress" min="0" max="100" step="5" (input)="progressChanged()"></label>
            <label class="form-field"><span class="form-label">البداية الفعلية</span><input type="date" formControlName="actualStart"></label>
            <label class="form-field"><span class="form-label">النهاية الفعلية</span><input type="date" formControlName="actualEnd"></label>
          </div>
          <label class="form-field"><span class="form-label">ملاحظة <small class="hint">{{ lowering() ? '(مطلوبة عند خفض النسبة)' : '(اختياري)' }}</small></span>
            <textarea formControlName="note" rows="2" maxlength="1000"></textarea></label>
          @if (history().length) {
            <details><summary>سجل التحديثات ({{ history().length }})</summary>
              <ul class="hist">@for (h of history(); track h.id) {
                <li><strong>{{ h.progress }}%</strong> · {{ h.statusName }} · {{ h.userName }} · {{ h.createdAt | utc | date:'yyyy/MM/dd HH:mm' }}@if (h.note) { — {{ h.note }} }</li>
              }</ul></details>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'حفظ التحديث' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.hist { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; color: var(--ink-600); } summary { cursor: pointer; font-weight: 700; }`]
})
export class ScheduleProgressDialog implements OnInit {
  private service = inject(ScheduleService);
  task = input.required<ScheduleTask>();
  busy = input(false);
  error = input('');
  submitted = output<ProgressInput>();
  closed = output<void>();
  problem = signal('');
  history = signal<ProgressEntry[]>([]);
  statuses = TASK_STATUSES;

  form = inject(FormBuilder).nonNullable.group({
    status: [1], progress: [0], actualStart: [''], actualEnd: [''], note: ['']
  });
  protected lowering() { return this.form.controls.progress.value < this.task().progress; }

  ngOnInit() {
    const t = this.task();
    this.form.reset({ status: t.status, progress: t.progress, actualStart: dateOnly(t.actualStart), actualEnd: dateOnly(t.actualEnd), note: '' });
    this.service.progressHistory(t.id).subscribe({ next: h => this.history.set(h), error: () => this.history.set([]) });
  }

  /** الاكتمال = 100% وعدم البدء = 0%: تُضبط النسبة مع الحالة كي لا يرفض الخادم تناقضها */
  statusChanged(status: number) {
    this.form.controls.status.setValue(status);
    if (status === TASK_COMPLETED) this.form.controls.progress.setValue(100);
    else if (status === 1) this.form.controls.progress.setValue(0);
    else if (this.form.controls.progress.value === 100) this.form.controls.progress.setValue(95);
  }

  /** 100% تعني مكتملاً */
  progressChanged() {
    const v = this.form.controls.progress.value;
    if (v === 100) this.form.controls.status.setValue(TASK_COMPLETED);
    else if (this.form.controls.status.value === TASK_COMPLETED) this.form.controls.status.setValue(2);
    else if (v > 0 && this.form.controls.status.value === 1) this.form.controls.status.setValue(2);
  }

  save() {
    const v = this.form.getRawValue();
    if (v.progress < this.task().progress && !v.note.trim()) { this.problem.set('خفض نسبة الإنجاز يحتاج ملاحظة تشرح السبب'); return; }
    this.problem.set('');
    this.submitted.emit({
      status: v.status, progress: v.progress, actualStart: v.actualStart || null, actualEnd: v.actualEnd || null,
      note: v.note.trim(), rowVersion: this.task().rowVersion
    });
  }
}
