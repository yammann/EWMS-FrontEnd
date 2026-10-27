import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { SelectValue } from '@shared/ui/select-value';
import { StatTile } from '@shared/ui/stat-tile';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { Project } from '../data-access/projects.models';
import {
  ProgressInput, SCHEDULE_APPROVED, SCHEDULE_DRAFT, ScheduleDetail, ScheduleOverview, ScheduleTask, StartOrderInput, TaskInput, percent
} from '../data-access/schedule.models';
import { ScheduleService } from '../data-access/schedule.service';
import { ScheduleDelaysPanel } from './schedule-delays-panel';
import { ScheduleDependenciesDialog, ScheduleProgressDialog, ScheduleTaskDialog, StartOrderDialog } from './schedule-dialogs';
import { ScheduleExtensionsPanel } from './schedule-extensions-panel';
import { ScheduleGantt } from './schedule-gantt';

type Section = 'plan' | 'delays' | 'extensions';

/**
 * تبويب «الجدول الزمني» في صفحة المشروع: أمر المباشرة، إصدارات الجدول (مسودة ← معتمد ← سابق) بمخطط غانت وجدول البنود،
 * ثم التأخيرات والتمديدات. النظام ينبّه ولا يقرّر: «مرشَّح للتأخر» تنبيه، والتأخير يسجّله مخوَّل، والتبرير والتمديد يعتمدهما غير من أعدّهما.
 * الأزرار من أعلام الخادم (canEdit/canApprove…) والخادم يرفض ما يخالف الحد أو فصل الإعداد عن الاعتماد.
 */
@Component({
  selector: 'app-project-schedule-panel', standalone: true,
  imports: [DatePipe, Alert, EmptyState, SelectValue, StatTile, ScheduleGantt, ScheduleDelaysPanel, ScheduleExtensionsPanel,
    StartOrderDialog, ScheduleTaskDialog, ScheduleDependenciesDialog, ScheduleProgressDialog],
  styleUrls: ['../../../shared/styles/data-tools.scss'],
  template: `
    <nav class="subtabs" role="tablist" aria-label="أقسام الجدول">
      @for (s of sections; track s.key) {
        <button type="button" role="tab" [class.active]="section() === s.key" [attr.aria-selected]="section() === s.key" (click)="section.set(s.key)">{{ s.label }}</button>
      }
    </nav>

    @switch (section()) {
      @case ('plan') {
        <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="reload()" />
        @if (overview(); as o) {
          @if (detail(); as d) {
            <div class="stat-grid">
              <app-stat-tile icon="trend" tone="green" label="الإنجاز الفعلي" [value]="pct(d.actualProgress)" hint="متوسط مرجَّح بأوزان البنود" />
              <app-stat-tile icon="clock" tone="blue" label="المخطط حتى اليوم" [value]="pct(d.plannedProgress)" hint="على التواريخ الحالية" />
              <app-stat-tile icon="target" tone="purple" label="خط الأساس" [value]="pct(d.baselineProgress)" hint="على التواريخ الأصلية" />
              <app-stat-tile icon="alarm" tone="orange" label="مرشَّحة للتأخر" [value]="'' + d.overdueCandidates" hint="تجاوزت نهايتها ولم تكتمل" [alert]="d.overdueCandidates > 0" />
            </div>
          }

          <section class="panel">
            <div class="panel-heading">
              <h2>أمر المباشرة</h2>
              @if (o.canEditStartOrder) { <button class="btn" type="button" (click)="startOrderOpen.set(true)">{{ o.startOrder ? 'تعديل' : '+ تسجيل الأمر' }}</button> }
            </div>
            @if (o.startOrder; as s) {
              <dl class="facts">
                <div><dt>رقم الأمر</dt><dd dir="ltr">{{ s.orderNumber }}</dd></div>
                <div><dt>تاريخ الأمر</dt><dd>{{ s.orderDate | date:'yyyy/MM/dd' }}</dd></div>
                <div><dt>تاريخ المباشرة</dt><dd>{{ s.startDate | date:'yyyy/MM/dd' }}</dd></div>
                <div><dt>مدة الإنجاز</dt><dd>{{ s.completionDays }} يوماً</dd></div>
                <div><dt>زمن التنفيذ</dt><dd>{{ s.executionDays }} يوماً</dd></div>
                <div><dt>مهندس الموقع</dt><dd>{{ s.siteEngineerName || '—' }}</dd></div>
                <div><dt>مشرف القطاع</dt><dd>{{ s.sectorSupervisorName || '—' }}</dd></div>
                @if (s.studyCost !== null) { <div><dt>تكلفة الدراسة</dt><dd>{{ s.studyCost }}</dd></div> }
              </dl>
            } @else { <p class="muted">لم يُسجَّل أمر المباشرة بعد؛ منه يبدأ الجدول الزمني.</p> }
          </section>

          <section class="panel">
            <div class="panel-heading">
              <h2>الجدول الزمني</h2>
              <div class="actions">
                @if (o.versions.length) {
                  <select #v class="version" aria-label="الإصدار" [appSelectValue]="selectedId() ?? 0" (change)="pick(+v.value)">
                    @for (x of o.versions; track x.id) { <option [value]="x.id">الإصدار {{ x.versionNumber }} — {{ x.statusName }}{{ x.title ? ' · ' + x.title : '' }}</option> }
                  </select>
                }
                @if (o.canEditSchedule && !o.draftScheduleId) { <button class="btn" type="button" [disabled]="busy()" (click)="createDraft(o)">{{ o.approvedScheduleId ? 'مسودة جديدة (إعادة إصدار)' : '+ مسودة جدول' }}</button> }
              </div>
            </div>

            @if (detail(); as d) {
              <p class="muted meta">أعدّه {{ d.createdByName }}{{ d.approvedByName ? ' · اعتمده ' + d.approvedByName : '' }} · <span class="pill" [class.pill-active]="d.status === approvedStatus">{{ d.statusName }}</span></p>
              @if (d.status === draftStatus && o.approvedScheduleId) {
                <p class="notice">مسودة إعادة إصدار: بنودها منسوخة من المعتمد وتواريخها الأصلية مثبّتة، وتتغير التواريخ الحالية بتمديد معتمد فقط.</p>
              }
              @if (d.warnings.length) {
                <ul class="warnings" role="status">@for (w of d.warnings; track w) { <li>{{ w }}</li> }</ul>
              }
              <div class="toolbar">
                @if (d.canEdit) {
                  <button class="btn" type="button" (click)="editTask(null)">+ بند</button>
                  <button class="btn btn-ghost" type="button" (click)="depsOpen.set(true)">التبعيات</button>
                  <button class="btn btn-ghost" type="button" [disabled]="busy()" (click)="deleteDraft(d)">حذف المسودة</button>
                }
                @if (d.canApprove) { <button class="btn" type="button" [disabled]="busy()" (click)="approve(d)">اعتماد الجدول</button> }
                @else if (d.status === draftStatus && d.canEdit) { <span class="muted">يعتمد الجدول موظف آخر غير من أعدّه.</span> }
              </div>

              <app-schedule-gantt [tasks]="d.tasks" [dependencies]="d.dependencies" [selectedId]="selectedTaskId()" (taskSelect)="selectedTaskId.set($event)" />

              @if (d.tasks.length) {
                <div class="table-wrap"><table>
                  <thead><tr><th>#</th><th>البند</th><th>البداية</th><th>النهاية</th><th>الوزن</th><th>الإنجاز</th><th>الحالة</th><th>المسؤول</th><th class="actions-th"></th></tr></thead>
                  <tbody>
                    @for (t of d.tasks; track t.id; let i = $index; let first = $first; let last = $last) {
                      <tr [class.picked]="t.id === selectedTaskId()" (click)="selectedTaskId.set(t.id)">
                        <td dir="ltr">{{ t.code || i + 1 }}</td>
                        <td class="cell-strong">{{ t.name }}
                          @if (t.isCritical) { <span class="pill red">حرج</span> }
                          @if (t.isOverdueCandidate) { <span class="pill warn" title="تجاوز نهايته ولم يكتمل — راجع حالته">مرشَّح للتأخر</span> }</td>
                        <td>{{ t.plannedStart | date:'yyyy/MM/dd' }}</td>
                        <td>{{ t.plannedEnd | date:'yyyy/MM/dd' }}
                          @if (t.extraDays) { <small class="extra" [title]="'النهاية الأصلية ' + (t.originalEnd | date:'yyyy/MM/dd')">+{{ t.extraDays }} يوماً</small> }</td>
                        <td>{{ t.weight }}</td>
                        <td>{{ t.progress }}%</td>
                        <td>{{ t.statusName }}</td>
                        <td>{{ t.assigneeName || '—' }}</td>
                        <td class="row-buttons" (click)="$event.stopPropagation()">
                          @if (d.canUpdateProgress) { <button type="button" class="ghost" (click)="progressTask.set(t)">إنجاز</button> }
                          @if (d.canClassify) { <button type="button" class="ghost" [disabled]="busy()" (click)="classify(t)">{{ t.isCritical ? 'غير حرج' : 'حرج' }}</button> }
                          @if (access().canRecordDelay && d.status === approvedStatus && t.isOverdueCandidate) { <button type="button" class="ghost" (click)="recordDelayFor(t)">تسجيل تأخير</button> }
                          @if (d.canEdit) {
                            <button type="button" class="ghost" aria-label="تحريك للأعلى" [disabled]="busy() || first" (click)="move(d, i, -1)">↑</button>
                            <button type="button" class="ghost" aria-label="تحريك للأسفل" [disabled]="busy() || last" (click)="move(d, i, 1)">↓</button>
                            <button type="button" class="ghost" (click)="editTask(t)">تعديل</button>
                            <button type="button" class="ghost" [disabled]="busy()" (click)="deleteTask(t)">حذف</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              }
            } @else if (loadingDetail()) {
              <app-empty-state>جارٍ التحميل…</app-empty-state>
            } @else if (!o.versions.length) {
              <p class="muted">لا جدول زمني لهذا المشروع بعد.{{ o.canEditSchedule ? ' ابدأ بمسودة جدول ثم أضف بنوده ووزن كل بند، وبعدها يعتمده موظف آخر.' : '' }}</p>
            }
          </section>
        } @else if (loading()) {
          <app-empty-state>جارٍ التحميل…</app-empty-state>
        }
      }
      @case ('delays') {
        <app-schedule-delays-panel [project]="project()" [tasks]="approvedTasks()" [recordTask]="recordTask()" [open]="open()"
          (recordHandled)="recordTask.set(null)" (changed)="changed.emit()" />
      }
      @case ('extensions') {
        <app-schedule-extensions-panel [project]="project()" [tasks]="approvedTasks()" [open]="open()" (changed)="extensionChanged()" />
      }
    }

    @if (startOrderOpen() && overview(); as o) {
      <app-start-order-dialog [order]="o.startOrder" [members]="project().members ?? []" [busy]="saving()" [error]="formError()"
        (submitted)="saveStartOrder($event)" (closed)="startOrderOpen.set(false)" />
    }
    @if (taskDialogOpen()) {
      <app-schedule-task-dialog [task]="editing()" [members]="project().members ?? []" [busy]="saving()" [error]="formError()"
        (submitted)="saveTask($event)" (closed)="taskDialogOpen.set(false)" />
    }
    @if (depsOpen() && detail(); as d) {
      <app-schedule-dependencies-dialog [tasks]="d.tasks" [dependencies]="d.dependencies" [busy]="saving()" [error]="formError()"
        (added)="addDependency($event.predecessorId, $event.successorId)" (remove)="removeDependency($event)" (closed)="depsOpen.set(false)" />
    }
    @if (progressTask(); as t) {
      <app-schedule-progress-dialog [task]="t" [busy]="saving()" [error]="formError()" (submitted)="saveProgress(t, $event)" (closed)="progressTask.set(null)" />
    }`,
  styles: [`
    :host { display: grid; gap: 16px; }
    .subtabs { display: flex; gap: 6px; padding: 4px; border-radius: var(--radius-lg); background: var(--fill); width: fit-content; max-width: 100%; }
    .subtabs button { min-height: 34px; padding: 0 14px; border-radius: var(--radius-md); background: transparent; color: var(--ink-600); font-weight: 700; box-shadow: none; }
    .subtabs button.active { background: var(--surface); color: var(--brand-700); }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 520px) { .stat-grid { grid-template-columns: 1fr; } }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .version { max-width: 280px; }
    .meta { margin: 0 0 8px; }
    .notice { margin: 0 0 8px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--fill); color: var(--ink-600); font-size: 13px; }
    .warnings { margin: 0 0 10px; padding: 10px 28px; border-radius: var(--radius-md); background: var(--warning-50); color: var(--warning-700); font-size: 13px; display: grid; gap: 4px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px 22px; margin: 0; }
    .facts div { display: grid; gap: 4px; } .facts dt { color: var(--ink-500); font-size: 12px; } .facts dd { margin: 0; font-weight: 700; }
    .pill.warn { background: var(--warning-100); color: var(--warning-700); }
    .pill-active { background: var(--brand-50); color: var(--brand-700); }
    .extra { margin-inline-start: 6px; color: var(--warning-700); font-weight: 700; }
    tr.picked td { background: var(--brand-50); }
    .row-buttons { white-space: nowrap; }
    .row-buttons .ghost { min-height: 30px; padding: 0 8px; font-size: 12px; }
    .table-wrap { margin-top: 14px; }
    .muted { color: var(--ink-500); line-height: 1.8; margin: 0; }
  `]
})
export class ProjectSchedulePanel {
  private service = inject(ScheduleService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private latest = latestRequest();
  private latestDetail = latestRequest();

  project = input.required<Project>();
  /** المشروع غير مغلق/ملغى */
  open = input(true);
  /** تغيّر شيء يُسجَّل في التدقيق: تُحدَّث لوحة التدقيق */
  changed = output<void>();

  access = this.service.access;
  sections: { key: Section; label: string }[] = [{ key: 'plan', label: 'الجدول' }, { key: 'delays', label: 'التأخيرات' }, { key: 'extensions', label: 'التمديدات' }];
  section = signal<Section>('plan');
  draftStatus = SCHEDULE_DRAFT;
  approvedStatus = SCHEDULE_APPROVED;
  pct = percent;

  overview = signal<ScheduleOverview | null>(null);
  detail = signal<ScheduleDetail | null>(null);
  selectedId = signal<number | null>(null);
  selectedTaskId = signal<number | null>(null);
  loading = signal(false);
  loadingDetail = signal(false);
  busy = signal(false);
  saving = signal(false);
  error = signal('');
  formError = signal('');

  startOrderOpen = signal(false);
  taskDialogOpen = signal(false);
  editing = signal<ScheduleTask | null>(null);
  depsOpen = signal(false);
  progressTask = signal<ScheduleTask | null>(null);
  recordTask = signal<ScheduleTask | null>(null);

  /** بنود الجدول المعتمد (للتأخير والتمديد): تُجلب مع الجدول المعروض إن كان معتمداً */
  approvedTasks = signal<ScheduleTask[]>([]);

  constructor() {
    effect(() => { const id = this.project().id; untracked(() => this.reload(id)); });
  }

  reload(projectId = this.project().id) {
    this.latest(this.service.overview(projectId), this.loading, this.error, o => {
      this.overview.set(o);
      const keep = o.versions.some(v => v.id === this.selectedId());
      const next = keep ? this.selectedId() : (o.approvedScheduleId ?? o.draftScheduleId ?? o.versions[0]?.id ?? null);
      this.selectedId.set(next);
      this.loadDetail(next);
      this.loadApproved(o);
    });
  }

  private loadDetail(id: number | null) {
    if (!id) { this.detail.set(null); return; }
    this.latestDetail(this.service.schedule(id), this.loadingDetail, this.error, d => this.detail.set(d));
  }

  /** بنود المعتمد للتأخير والتمديد (تُجلب بمعزل عن الإصدار المعروض) */
  private loadApproved(o: ScheduleOverview) {
    if (!o.approvedScheduleId) { this.approvedTasks.set([]); return; }
    this.service.schedule(o.approvedScheduleId).subscribe({ next: d => this.approvedTasks.set(d.tasks), error: () => this.approvedTasks.set([]) });
  }

  pick(id: number) { this.selectedId.set(id); this.selectedTaskId.set(null); this.loadDetail(id); }

  /** بعد أي تغيير: يُعاد الملخص والإصدار المعروض ويُحدَّث التدقيق */
  private refresh(message?: string) {
    if (message) this.toast.success(message);
    this.reload();
    this.changed.emit();
  }

  private run<T>(source: import('rxjs').Observable<T>, done: (value: T) => void, flag = this.busy) {
    trackRequest(source, flag, this.error, done);
  }

  // ───────── أمر المباشرة ─────────
  saveStartOrder(v: StartOrderInput) {
    trackRequest(this.service.saveStartOrder(this.project().id, v), this.saving, this.formError, () => { this.startOrderOpen.set(false); this.refresh('حُفظ أمر المباشرة'); });
  }

  // ───────── الإصدارات ─────────
  async createDraft(o: ScheduleOverview) {
    const message = o.approvedScheduleId
      ? 'تُنشأ مسودة جديدة منسوخة من الجدول المعتمد (بنوده وتبعياته وتواريخه الأصلية). لا يتغير المعتمد حتى تُعتمد المسودة. المتابعة؟'
      : 'إنشاء مسودة جدول جديدة؟';
    if (!await this.confirm.ask(message, 'إنشاء')) return;
    this.run(this.service.createDraft(this.project().id, '', ''), d => { this.selectedId.set(d.id); this.refresh('أُنشئت المسودة'); });
  }

  async approve(d: ScheduleDetail) {
    if (!await this.confirm.ask('اعتماد هذا الجدول؟ تُثبَّت تواريخ بنوده الأصلية (خط الأساس) ولا تتغير بعدها، وتتغير التواريخ الحالية بتمديد معتمد فقط.', 'اعتماد')) return;
    this.run(this.service.approve(d.id), () => this.refresh('اعتُمد الجدول'));
  }

  async deleteDraft(d: ScheduleDetail) {
    if (!await this.confirm.ask('حذف مسودة الجدول وبنودها وتبعياتها؟', 'حذف')) return;
    this.selectedId.set(null);
    this.run(this.service.deleteDraft(d.id), () => this.refresh('حُذفت المسودة'));
  }

  // ───────── البنود ─────────
  editTask(t: ScheduleTask | null) { this.formError.set(''); this.editing.set(t); this.taskDialogOpen.set(true); }

  saveTask(v: TaskInput) {
    const d = this.detail();
    if (!d) return;
    const t = this.editing();
    const call = t ? this.service.updateTask(t.id, v) : this.service.addTask(d.id, v);
    trackRequest(call, this.saving, this.formError, () => { this.taskDialogOpen.set(false); this.refresh(t ? 'حُفظ البند' : 'أُضيف البند'); });
  }

  async deleteTask(t: ScheduleTask) {
    if (!await this.confirm.ask(`حذف البند «${t.name}» وتبعياته؟`, 'حذف')) return;
    this.run(this.service.deleteTask(t.id), () => this.refresh('حُذف البند'));
  }

  move(d: ScheduleDetail, index: number, by: -1 | 1) {
    const ids = d.tasks.map(t => t.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    this.run(this.service.reorder(d.id, ids), () => this.loadDetail(d.id));
  }

  addDependency(predecessorId: number, successorId: number) {
    const d = this.detail();
    if (!d) return;
    trackRequest(this.service.addDependency(d.id, predecessorId, successorId), this.saving, this.formError, () => { this.formError.set(''); this.refresh(); });
  }

  removeDependency(id: number) {
    trackRequest(this.service.removeDependency(id), this.saving, this.formError, () => { this.formError.set(''); this.refresh(); });
  }

  // ───────── الإنجاز والتصنيف ─────────
  saveProgress(t: ScheduleTask, v: ProgressInput) {
    trackRequest(this.service.updateProgress(t.id, v), this.saving, this.formError, () => { this.progressTask.set(null); this.refresh('حُدّث الإنجاز'); });
  }

  classify(t: ScheduleTask) {
    this.run(this.service.classify(t.id, !t.isCritical, t.rowVersion), () => this.refresh(t.isCritical ? 'أُلغي تصنيف «حرج»' : 'صُنّف البند حرجاً'));
  }

  // ───────── التأخير والتمديد ─────────
  recordDelayFor(t: ScheduleTask) { this.recordTask.set(t); this.section.set('delays'); }

  /** اعتماد تمديد يغيّر التواريخ الحالية: يُعاد الجدول */
  extensionChanged() { this.reload(); this.changed.emit(); }
}
