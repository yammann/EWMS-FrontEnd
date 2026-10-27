import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Project } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';
import {
  DELAY_APPROVED, EXT_CALENDAR, EXT_DRAFT, EXT_GROUP, EXT_REJECTED, EXT_SINGLE, EXT_SUBMITTED, EXT_WORKING, ExtensionInput,
  ExtensionPreview, ScheduleDelay, ScheduleExtension, ScheduleTask, TASK_COMPLETED
} from '../data-access/schedule.models';
import { ScheduleService } from '../data-access/schedule.service';
import { ScheduleDecisionDialog, VersionChoice, projectVersionChoices } from './schedule-shared';

const STYLE = '../../../shared/styles/data-tools.scss';

interface Line { days: number; movesStart: boolean; }

/**
 * إعداد طلب تمديد على الجدول المعتمد: جماعي (عدد أيام واحد) أو مستقل (مدة لكل بند)، بأيام تقويمية أو أيام عمل (بلا الجمعة والعطل الرسمية).
 * «معاينة» تُظهر التواريخ الجديدة والتعارضات واللواحق المقترحة دون حفظ شيء؛ اللاحق لا يُزاح إلا باختيارك صراحة. الاعتماد يتم من موظف آخر.
 */
@Component({
  selector: 'app-extension-dialog', standalone: true, imports: [FormsModule, DatePipe, Modal, Alert, SelectValue], styleUrl: STYLE,
  template: `
    <app-modal [heading]="extension() ? 'تعديل طلب التمديد' : 'طلب تمديد'" subheading="يُعاين قبل الحفظ، ويعتمده موظف آخر" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <fieldset class="choices">
            <label><input type="radio" name="mode" [checked]="mode() === group" (change)="setMode(group)"> جماعي (عدد أيام واحد)</label>
            <label><input type="radio" name="mode" [checked]="mode() === single" (change)="setMode(single)"> مستقل (مدة لكل بند)</label>
            <span class="sep"></span>
            <label><input type="radio" name="count" [checked]="dayCount() === calendar" (change)="dayCount.set(calendar); invalidate()"> أيام تقويمية</label>
            <label><input type="radio" name="count" [checked]="dayCount() === working" (change)="dayCount.set(working); invalidate()"> أيام عمل (بلا الجمعة والعطل الرسمية)</label>
          </fieldset>
          @if (mode() === group) {
            <label class="form-field narrow"><span class="form-label">عدد الأيام</span>
              <input type="number" name="days" min="1" max="365" [ngModel]="groupDays()" (ngModelChange)="setGroupDays($event)"></label>
          }

          <div class="table-wrap picker"><table>
            <thead><tr><th></th><th>البند</th><th>ينتهي</th>@if (mode() === single) { <th>الأيام</th> }<th>إزاحة (لاحق)</th></tr></thead>
            <tbody>
              @for (t of choices(); track t.id) {
                @let l = lines()[t.id];
                <tr>
                  <td><input type="checkbox" [attr.aria-label]="t.name" [checked]="!!l" (change)="toggle(t, $any($event.target).checked)"></td>
                  <td class="cell-strong">{{ t.name }}</td>
                  <td>{{ t.plannedEnd | date:'yyyy/MM/dd' }}</td>
                  @if (mode() === single) {
                    <td><input type="number" class="days" min="1" max="365" [disabled]="!l" [ngModel]="l?.days ?? groupDays()" [name]="'d' + t.id" (ngModelChange)="setDays(t.id, $event)"></td>
                  }
                  <td><input type="checkbox" [attr.aria-label]="'إزاحة ' + t.name" [disabled]="!l" [checked]="!!l?.movesStart" (change)="setMoves(t.id, $any($event.target).checked)"></td>
                </tr>
              }
            </tbody>
          </table></div>

          <label class="form-field"><span class="form-label">سبب التمديد</span><textarea name="reason" [(ngModel)]="reason" rows="2" maxlength="2000"></textarea></label>

          @if (delays().length) {
            <label class="form-field"><span class="form-label">تأخير معتمد التبرير <small class="hint">(اختياري)</small></span>
              <select #dl [appSelectValue]="delayId()" (change)="delayId.set(+dl.value)">
                <option value="0">بلا ربط</option>@for (d of delays(); track d.id) { <option [value]="d.id">{{ d.taskName }} — اكتُشف {{ d.discoveredAt | date:'yyyy/MM/dd' }}</option> }
              </select></label>
          }
          @if (versions().length) {
            <fieldset class="docs"><legend>مستندات داعمة (من وثائق المشروع)</legend>
              @for (v of versions(); track v.id) { <label><input type="checkbox" [checked]="docs().has(v.id)" (change)="toggleDoc(v.id, $any($event.target).checked)"> {{ v.label }}</label> }
            </fieldset>
          }

          <div><button type="button" class="btn btn-ghost" [disabled]="busy() || previewing() || !count()" (click)="preview()">{{ previewing() ? 'جارٍ الحساب…' : 'معاينة النتيجة' }}</button></div>
          @if (previewData(); as p) {
            <div class="table-wrap"><table>
              <thead><tr><th>البند</th><th>النهاية الحالية</th><th>النهاية الجديدة</th><th>الأيام</th></tr></thead>
              <tbody>@for (i of p.items; track i.taskId) {
                <tr><td class="cell-strong">{{ i.taskName }}{{ i.movesStart ? ' (إزاحة)' : '' }}</td><td>{{ i.oldEnd | date:'yyyy/MM/dd' }}</td><td>{{ i.newEnd | date:'yyyy/MM/dd' }}</td><td>+{{ i.days }}</td></tr>
              }</tbody>
            </table></div>
            @if (p.conflicts.length) {
              <ul class="warnings" role="status">@for (c of p.conflicts; track c.predecessorId + '-' + c.successorId) { <li>«{{ c.successorName }}» يبدأ قبل نهاية «{{ c.predecessorName }}» الجديدة</li> }</ul>
            }
            @if (p.suggestedTasks.length) {
              <div class="suggest"><strong>لواحق قد تتأثر (للمراجعة، لا تُزاح تلقائياً):</strong>
                @for (s of p.suggestedTasks; track s.taskId) { <button type="button" class="pill" (click)="addSuccessor(s.taskId)">+ {{ s.name }}</button> }
              </div>
            }
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'حفظ كمسودة' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .choices { display: flex; flex-wrap: wrap; gap: 14px 18px; border: 0; padding: 0; margin: 0; align-items: center; } .choices label { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; }
    .sep { width: 1px; height: 20px; background: var(--ink-300); }
    .narrow { max-width: 160px; } .days { width: 80px; }
    .picker { max-height: 260px; overflow: auto; }
    .docs { display: grid; gap: 6px; max-height: 150px; overflow: auto; border: 1px solid var(--ink-300); border-radius: var(--radius-md); padding: 10px 12px; } .docs label { display: flex; gap: 6px; }
    .warnings { margin: 0; padding: 10px 28px; border-radius: var(--radius-md); background: var(--warning-50); color: var(--warning-700); font-size: 13px; display: grid; gap: 4px; }
    .suggest { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; } .suggest .pill { cursor: pointer; border: 0; }
  `]
})
export class ExtensionDialog implements OnInit {
  private service = inject(ScheduleService);
  private projects = inject(ProjectsService);

  project = input.required<Project>();
  tasks = input.required<readonly ScheduleTask[]>();
  /** تأخيرات معتمدة التبرير تصلح للربط */
  delays = input<readonly ScheduleDelay[]>([]);
  extension = input<ScheduleExtension | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<ExtensionInput>();
  closed = output<void>();

  group = EXT_GROUP; single = EXT_SINGLE; calendar = EXT_CALENDAR; working = EXT_WORKING;
  mode = signal<number>(EXT_GROUP);
  dayCount = signal<number>(EXT_CALENDAR);
  groupDays = signal(7);
  lines = signal<Record<number, Line>>({});
  delayId = signal(0);
  docs = signal<Set<number>>(new Set());
  versions = signal<VersionChoice[]>([]);
  reason = '';
  problem = signal('');
  previewData = signal<ExtensionPreview | null>(null);
  previewing = signal(false);

  choices = computed(() => this.tasks().filter(t => t.status !== TASK_COMPLETED));
  count = computed(() => Object.keys(this.lines()).length);

  ngOnInit() {
    const x = this.extension();
    if (x) {
      this.mode.set(x.mode); this.dayCount.set(x.dayCount); this.reason = x.reason; this.delayId.set(x.delayId ?? 0);
      this.lines.set(Object.fromEntries(x.items.map(i => [i.taskId, { days: i.days, movesStart: i.movesStart }])));
      this.groupDays.set(x.items[0]?.days ?? 7);
      this.docs.set(new Set(x.documents.map(d => d.versionId)));
    }
    if (this.service.access().canListDocuments) {
      projectVersionChoices(this.projects, this.project().id).subscribe({ next: v => this.versions.set(v), error: () => this.versions.set([]) });
    }
  }

  invalidate() { this.previewData.set(null); }
  setMode(mode: number) { this.mode.set(mode); if (mode === EXT_GROUP) this.syncGroup(); this.invalidate(); }
  setGroupDays(days: number) { this.groupDays.set(days); this.syncGroup(); this.invalidate(); }
  private syncGroup() { const d = this.groupDays(); this.lines.update(l => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, days: d }]))); }

  toggle(t: ScheduleTask, on: boolean) {
    this.lines.update(l => { const next = { ...l }; if (on) next[t.id] = { days: this.groupDays(), movesStart: false }; else delete next[t.id]; return next; });
    this.invalidate();
  }
  setDays(id: number, days: number) { this.lines.update(l => ({ ...l, [id]: { ...l[id], days } })); this.invalidate(); }
  setMoves(id: number, on: boolean) { this.lines.update(l => ({ ...l, [id]: { ...l[id], movesStart: on } })); this.invalidate(); }
  addSuccessor(id: number) {
    this.lines.update(l => ({ ...l, [id]: { days: this.groupDays(), movesStart: true } }));
    this.preview();
  }
  toggleDoc(id: number, on: boolean) { this.docs.update(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }); }

  private build(): ExtensionInput {
    return {
      delayId: this.delayId() || null, mode: this.mode(), dayCount: this.dayCount(), reason: this.reason.trim(),
      lines: Object.entries(this.lines()).map(([id, l]) => ({ taskId: +id, days: l.days, movesStart: l.movesStart })),
      documentVersionIds: [...this.docs()], ...(this.extension() ? { rowVersion: this.extension()!.rowVersion } : {})
    };
  }

  preview() {
    if (!this.count()) return;
    this.previewing.set(true); this.problem.set('');
    this.service.previewExtension(this.project().id, this.build()).subscribe({
      next: p => { this.previewing.set(false); this.previewData.set(p); },
      error: e => { this.previewing.set(false); this.problem.set((e as { message?: string }).message ?? ''); }
    });
  }

  save() {
    if (!this.count()) { this.problem.set('اختر بنداً واحداً على الأقل'); return; }
    if (!this.reason.trim()) { this.problem.set('سبب التمديد مطلوب'); return; }
    this.problem.set('');
    this.submitted.emit(this.build());
  }
}

/** طلبات التمديد على الجدول المعتمد: مسودة ← مرفوع للاعتماد ← معتمد أو مرفوض. طلب واحد غير مبتوت فيه للمشروع. */
@Component({
  selector: 'app-schedule-extensions-panel', standalone: true,
  imports: [DatePipe, Alert, EmptyState, Modal, UtcPipe, ExtensionDialog, ScheduleDecisionDialog],
  styleUrl: STYLE,
  template: `
    <section class="panel">
      <div class="panel-heading">
        <h2>طلبات التمديد <span class="count">({{ extensions().length }})</span></h2>
        @if (access().canRequestExtension && open() && tasks().length && !pending()) { <button class="btn" type="button" (click)="openForm(null)">+ طلب تمديد</button> }
      </div>
      <p class="muted">التواريخ الحالية للبنود لا تتغير إلا باعتماد تمديد (يعتمده غير صاحب الطلب)، والتواريخ الأصلية تبقى ثابتة كخط أساس.
        @if (pending()) { <strong>يوجد طلب لم يُبتّ فيه: أنهِه قبل إعداد غيره.</strong> }</p>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (extensions().length) {
        <div class="table-wrap"><table>
          <thead><tr><th>الحالة</th><th>النوع</th><th>البنود</th><th>السبب</th><th>الطالب</th><th>التاريخ</th><th class="actions-th"></th></tr></thead>
          <tbody>
            @for (x of extensions(); track x.id) {
              <tr>
                <td><span class="pill" [class.red]="x.status === rejected" [class.pill-active]="x.status === submitted">{{ x.statusName }}</span></td>
                <td>{{ x.modeName }} · {{ x.dayCountName }}</td>
                <td>{{ x.items.length }}</td>
                <td class="clip">{{ x.reason }}</td>
                <td>{{ x.requestedByName }}</td>
                <td>{{ x.requestedAt | utc | date:'yyyy/MM/dd' }}</td>
                <td class="row-buttons">
                  <button type="button" class="ghost" (click)="openDetail(x)">تفاصيل</button>
                  @if (x.canEdit) {
                    <button type="button" class="ghost" (click)="openForm(x)">تعديل</button>
                    <button type="button" class="ghost" [disabled]="busy()" (click)="submit(x)">رفع للاعتماد</button>
                    <button type="button" class="ghost" [disabled]="busy()" (click)="remove(x)">حذف</button>
                  }
                  @if (x.canDecide) { <button type="button" class="ghost" (click)="openDecide(x)">قرار</button> }
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      } @else if (loading()) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else { <p class="muted">لا طلبات تمديد.</p> }
    </section>

    @if (formOpen()) {
      <app-extension-dialog [project]="project()" [tasks]="tasks()" [delays]="approvedDelays()" [extension]="editing()" [busy]="saving()" [error]="formError()"
        (submitted)="save($event)" (closed)="formOpen.set(false)" />
    }
    @if (deciding(); as x) {
      <app-schedule-decision-dialog heading="قرار على طلب التمديد" [subheading]="'طلب ' + x.requestedByName" approveLabel="اعتماد التمديد" [busy]="saving()" [error]="formError()"
        (submitted)="decide(x, $event)" (closed)="deciding.set(null)">
        @if (x.staleProblem) { <p class="alert alert-warning" role="status">{{ x.staleProblem }}</p> }
        <div class="table-wrap"><table>
          <thead><tr><th>البند</th><th>النهاية الحالية</th><th>الجديدة</th><th>الأيام</th></tr></thead>
          <tbody>@for (i of x.items; track i.taskId) { <tr><td class="cell-strong">{{ i.taskName }}</td><td>{{ i.oldEnd | date:'yyyy/MM/dd' }}</td><td>{{ i.newEnd | date:'yyyy/MM/dd' }}</td><td>+{{ i.days }}</td></tr> }</tbody>
        </table></div>
        @if (x.conflicts.length) {
          <ul class="warnings" role="status">@for (c of x.conflicts; track c.predecessorId + '-' + c.successorId) { <li>«{{ c.successorName }}» يبدأ قبل نهاية «{{ c.predecessorName }}» الجديدة</li> }</ul>
        }
        <p class="muted"><strong>السبب:</strong> {{ x.reason }}</p>
      </app-schedule-decision-dialog>
    }
    @if (detail(); as x) {
      <app-modal heading="طلب تمديد" [subheading]="x.statusName + ' · ' + x.modeName + ' · ' + x.dayCountName" size="lg" (closed)="detail.set(null)">
        <div class="modal-body form-stack">
          @if (x.staleProblem) { <p class="alert alert-warning" role="status">{{ x.staleProblem }}</p> }
          <p class="muted"><strong>السبب:</strong> {{ x.reason }}</p>
          <div class="table-wrap"><table>
            <thead><tr><th>البند</th><th>البداية</th><th>النهاية</th><th>الأيام</th></tr></thead>
            <tbody>@for (i of x.items; track i.taskId) {
              <tr><td class="cell-strong">{{ i.taskName }}{{ i.movesStart ? ' (إزاحة)' : '' }}</td>
                <td>{{ i.oldStart | date:'yyyy/MM/dd' }}{{ i.movesStart ? ' ← ' + (i.newStart | date:'yyyy/MM/dd') : '' }}</td>
                <td>{{ i.oldEnd | date:'yyyy/MM/dd' }} ← {{ i.newEnd | date:'yyyy/MM/dd' }}</td><td>+{{ i.days }}</td></tr>
            }</tbody>
          </table></div>
          @if (x.conflicts.length) {
            <ul class="warnings" role="status">@for (c of x.conflicts; track c.predecessorId + '-' + c.successorId) { <li>«{{ c.successorName }}» يبدأ قبل نهاية «{{ c.predecessorName }}»</li> }</ul>
          }
          @if (x.suggestedTasks.length) { <p class="muted"><strong>لواحق قد تتأثر (للمراجعة):</strong> {{ names(x.suggestedTasks) }}</p> }
          @if (x.documents.length) { <p class="muted"><strong>المستندات:</strong> {{ docNames(x) }}</p> }
          @if (x.decidedByName) { <p class="muted"><strong>القرار:</strong> {{ x.statusName }} — {{ x.decidedByName }} · {{ x.decidedAt | utc | date:'yyyy/MM/dd HH:mm' }}{{ x.decisionNote ? ' — ' + x.decisionNote : '' }}</p> }
        </div>
        <footer class="modal-actions"><button type="button" (click)="detail.set(null)">إغلاق</button></footer>
      </app-modal>
    }`,
  styles: [`
    .muted { color: var(--ink-500); line-height: 1.8; margin: 0 0 8px; }
    .clip { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-buttons { white-space: nowrap; } .row-buttons .ghost { min-height: 30px; padding: 0 8px; font-size: 12px; }
    .pill-active { background: var(--brand-50); color: var(--brand-700); }
    .warnings { margin: 0; padding: 10px 28px; border-radius: var(--radius-md); background: var(--warning-50); color: var(--warning-700); font-size: 13px; display: grid; gap: 4px; }
  `]
})
export class ScheduleExtensionsPanel {
  private service = inject(ScheduleService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  project = input.required<Project>();
  /** بنود الجدول المعتمد */
  tasks = input<readonly ScheduleTask[]>([]);
  open = input(true);
  /** اعتُمد تمديد (تغيّرت التواريخ) أو تغيّر شيء مُدقَّق */
  changed = output<void>();

  access = this.service.access;
  rejected = EXT_REJECTED;
  submitted = EXT_SUBMITTED;
  extensions = signal<ScheduleExtension[]>([]);
  approvedDelays = signal<ScheduleDelay[]>([]);
  loading = signal(false);
  busy = signal(false);
  saving = signal(false);
  error = signal('');
  formError = signal('');
  formOpen = signal(false);
  editing = signal<ScheduleExtension | null>(null);
  deciding = signal<ScheduleExtension | null>(null);
  detail = signal<ScheduleExtension | null>(null);

  /** مسودة أو مرفوع بانتظار القرار */
  pending = computed(() => this.extensions().some(x => x.status === EXT_DRAFT || x.status === EXT_SUBMITTED));

  constructor() {
    effect(() => { const id = this.project().id; untracked(() => this.load(id)); });
  }

  load(id = this.project().id) {
    this.latest(this.service.extensions(id), this.loading, this.error, x => this.extensions.set(x));
    this.service.delays(id).subscribe({ next: d => this.approvedDelays.set(d.filter(x => x.status === DELAY_APPROVED)), error: () => this.approvedDelays.set([]) });
  }

  openForm(x: ScheduleExtension | null) { this.formError.set(''); this.editing.set(x); this.formOpen.set(true); }

  save(v: ExtensionInput) {
    const x = this.editing();
    const call = x ? this.service.updateExtension(x.id, v) : this.service.createExtension(this.project().id, v);
    trackRequest(call, this.saving, this.formError, () => { this.formOpen.set(false); this.toast.success('حُفظ الطلب كمسودة'); this.load(); this.changed.emit(); });
  }

  /** يُجلب طازجاً: التعارضات واللواحق وتقادم التواريخ تُحسب عند القراءة */
  private fresh(x: ScheduleExtension, next: (f: ScheduleExtension) => void) {
    this.service.extension(x.id).subscribe({ next, error: e => this.error.set((e as { message?: string }).message ?? '') });
  }

  openDetail(x: ScheduleExtension) { this.fresh(x, f => this.detail.set(f)); }
  openDecide(x: ScheduleExtension) { this.formError.set(''); this.fresh(x, f => this.deciding.set(f)); }

  async submit(x: ScheduleExtension) {
    if (!await this.confirm.ask('رفع الطلب للاعتماد؟ لا يعدّل صاحبه بعدها، ويقرّره موظف آخر.', 'رفع')) return;
    trackRequest(this.service.submitExtension(x.id), this.busy, this.error, () => { this.toast.success('رُفع الطلب للاعتماد'); this.load(); this.changed.emit(); });
  }

  async remove(x: ScheduleExtension) {
    if (!await this.confirm.ask('حذف مسودة طلب التمديد؟', 'حذف')) return;
    trackRequest(this.service.deleteExtension(x.id), this.busy, this.error, () => { this.toast.success('حُذفت المسودة'); this.load(); this.changed.emit(); });
  }

  decide(x: ScheduleExtension, e: { approve: boolean; note: string }) {
    trackRequest(this.service.decideExtension(x.id, { approve: e.approve, note: e.note, rowVersion: x.rowVersion }), this.saving, this.formError, () => {
      this.deciding.set(null); this.toast.success(e.approve ? 'اعتُمد التمديد وتحدّثت التواريخ' : 'رُفض الطلب'); this.load(); this.changed.emit();
    });
  }

  names(list: { name: string }[]) { return list.map(x => x.name).join('، '); }
  docNames(x: ScheduleExtension) { return x.documents.map(d => `${d.documentTitle} (الإصدار ${d.versionNumber})`).join('، '); }
}
