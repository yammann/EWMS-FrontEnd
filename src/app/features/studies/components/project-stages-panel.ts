import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Icon } from '@shared/ui/icon';
import { ToastService } from '@shared/ui/toast.service';
import { StudyAccess } from '../data-access/study-access';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { ProjectStage, StageTask, StudyProject } from '../data-access/studies.models';
import { StudyProgress } from './progress-bar';
import { StudyStageFormDialog } from './stage-form-dialog';
import { StudyStatusChip } from './study-status-chip';
import { StudyTaskFormDialog } from './task-form-dialog';
import { StudyTaskProgressDialog } from './task-progress-dialog';

const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';

/**
 * مراحل المشروع بمهامها: كل مرحلة بطاقة فيها نسبتها ووزنها وتواريخها وقسمها المسؤول ومهامها.
 * المراحل متتابعة: تُغلق بالترتيب بعد إنجاز كل مهامها، ولا يُعاد فتح إلا الأخيرة المغلقة. مراحل المستندات يصنعها النظام
 * مغلقة ولا تُعدَّل ولا تُحذف. الأزرار حسب صلاحيات المستخدم وحالة المرحلة، والخادم يرفض ما لا يجوز برسالة عربية.
 * عند أي تغيير يُطلق `changed` فتعيد صفحة المشروع تحميل المشروع ومهامه.
 */
@Component({
  selector: 'app-study-project-stages-panel',
  standalone: true,
  imports: [Alert, Icon, StudyProgress, StudyStatusChip, StudyStageFormDialog, StudyTaskFormDialog, StudyTaskProgressDialog],
  template: `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>المراحل والمهام</h2><p>تُغلق المراحل بالترتيب بعد إنجاز كل مهامها. نسبة المشروع من أوزان المراحل.</p></div>
        @if (can().createStage && project().status === 1) { <button type="button" class="btn" (click)="stageDialog.set({ stage: null })">+ مرحلة</button> }
      </div>
      <app-alert [message]="error()" />

      @if (!project().stages.length) { <p class="muted">لا مراحل بعد.</p> }
      <ol class="stages">
        @for (s of project().stages; track s.id; let first = $first; let last = $last) {
          <li class="stage" [class.closed]="s.status === 3">
            <header>
              <span class="order" aria-hidden="true">{{ s.sortOrder }}</span>
              <div class="title">
                <strong>{{ s.stageTypeName }}</strong>
                <small class="muted">
                  وزن {{ s.weight }}@if (s.responsibleDepartmentName) { · {{ s.responsibleDepartmentName }} }
                  · {{ fmt(s.plannedStartDate) }} ← {{ fmt(s.plannedEndDate) }}
                  @if (s.linkedDocument) { · مرحلة مستند }
                </small>
              </div>
              <app-study-status-chip kind="progress" [status]="s.status" [name]="s.statusName" />
              <app-study-progress [percent]="s.progress" />
            </header>

            <div class="stage-actions">
              @if (can().closeStage && s.status !== 3 && !busy()) { <button type="button" class="btn btn-sm" (click)="close(s)">إغلاق المرحلة</button> }
              @if (can().closeStage && s.status === 3 && !s.linkedDocument && last) { <button type="button" class="btn btn-ghost btn-sm" (click)="reopen(s)">إعادة فتح</button> }
              @if (s.canAddTask) { <button type="button" class="btn btn-ghost btn-sm" (click)="taskDialog.set({ stage: s, task: null })">+ مهمة</button> }
              @if (can().editStage && s.status !== 3 && !s.linkedDocument) { <button type="button" class="btn btn-ghost btn-sm" (click)="stageDialog.set({ stage: s })">تعديل</button> }
              @if (can().editStage && !s.linkedDocument && s.status !== 3) {
                <button type="button" class="icon-btn" aria-label="تقديم المرحلة" [disabled]="first || busy()" (click)="move(s, -1)"><app-icon name="turnUp" [size]="15" /></button>
                <button type="button" class="icon-btn down" aria-label="تأخير المرحلة" [disabled]="last || busy()" (click)="move(s, 1)"><app-icon name="turnUp" [size]="15" /></button>
              }
              @if (can().deleteStage && !s.linkedDocument && s.status !== 3) { <button type="button" class="icon-btn del" aria-label="حذف المرحلة" (click)="removeStage(s)"><app-icon name="trash" [size]="15" /></button> }
            </div>

            @if (tasksOf(s.id); as list) {
              @if (list.length) {
                <div class="table-wrap"><table>
                  <thead><tr><th>المهمة</th><th>المسندة إلى</th><th>الفترة المخططة</th><th>الوزن</th><th>الإنجاز</th><th>الحالة</th><th></th></tr></thead>
                  <tbody>
                    @for (t of list; track t.id) {
                      <tr>
                        <td><span class="cell-strong">{{ t.title }}</span>@if (t.description) { <small>{{ t.description }}</small> }</td>
                        <td>{{ t.targetTypeName }}: {{ t.targetName }}</td>
                        <td class="mono">{{ fmt(t.plannedStartDate) }} ← {{ fmt(t.plannedEndDate) }}</td>
                        <td class="mono">{{ t.weight }}</td>
                        <td><app-study-progress [percent]="t.progress" /></td>
                        <td><app-study-status-chip kind="progress" [status]="t.status" [name]="t.statusName" /></td>
                        <td class="row-end">
                          <div class="cell-actions">
                            @if (t.canUpdateProgress) { <button type="button" class="btn btn-sm" (click)="progressDialog.set(t)">تحديث الإنجاز</button> }
                            @if (t.canEdit && can().editTask) { <button type="button" class="btn btn-ghost btn-sm" (click)="taskDialog.set({ stage: s, task: t })">تعديل</button> }
                            @if (t.canEdit && can().deleteTask) { <button type="button" class="icon-btn del" aria-label="حذف المهمة" (click)="removeTask(t)"><app-icon name="trash" [size]="15" /></button> }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              } @else if (!s.linkedDocument) {
                <p class="muted none">{{ hidden(s) ? s.tasksTotal + ' مهمة في هذه المرحلة، لا تظهر لك تفاصيلها.' : 'لا مهام في هذه المرحلة.' }}</p>
              }
              @if (list.length && hidden(s)) { <p class="muted none">تظهر لك {{ list.length }} من {{ s.tasksTotal }} مهمة في هذه المرحلة.</p> }
            }
          </li>
        }
      </ol>
    </section>

    @if (stageDialog(); as d) {
      @defer (on immediate) { <app-study-stage-form-dialog [project]="project()" [stage]="d.stage" (closed)="stageDialog.set(null)" (saved)="done('حُفظت المرحلة'); stageDialog.set(null)" /> }
    }
    @if (taskDialog(); as d) {
      @defer (on immediate) { <app-study-task-form-dialog [project]="project()" [stage]="d.stage" [task]="d.task" (closed)="taskDialog.set(null)" (saved)="done('حُفظت المهمة'); taskDialog.set(null)" /> }
    }
    @if (progressDialog(); as t) {
      @defer (on immediate) { <app-study-task-progress-dialog [task]="t" (closed)="progressDialog.set(null)" (saved)="done('حُدّث الإنجاز'); progressDialog.set(null)" /> }
    }
  `,
  styles: [`
    .stages { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .stage { padding: 14px; border-radius: 14px; background: var(--fill); display: grid; gap: 10px; min-width: 0; }
    .stage.closed { background: var(--brand-50); }
    header { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto minmax(140px, 220px); align-items: center; gap: 12px; }
    .order { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--material, #fff); font-weight: 700; font-size: 13px; }
    .title { display: grid; min-width: 0; }
    .stage-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .icon-btn.down app-icon { transform: rotate(180deg); display: inline-grid; }
    .del { color: var(--danger-700); }
    .none { margin: 0; font-size: 13px; }
    td small { display: block; color: var(--ink-500); font-size: 12px; }
    .cell-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; white-space: nowrap; }
    @media (max-width: 760px) { header { grid-template-columns: 32px minmax(0, 1fr); } header app-study-progress { grid-column: 1 / -1; } }
  `]
})
export class StudyProjectStagesPanel {
  private service = inject(StudyProjectsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  project = input.required<StudyProject>();
  /** كل مهام المشروع (تُحمَّل مرة في الصفحة وتتشاركها اللوحة والـ Gantt) */
  tasks = input<StageTask[]>([]);
  changed = output<void>();

  can = inject(StudyAccess).can;
  busy = signal(false);
  error = signal('');
  stageDialog = signal<{ stage: ProjectStage | null } | null>(null);
  taskDialog = signal<{ stage: ProjectStage; task: StageTask | null } | null>(null);
  progressDialog = signal<StageTask | null>(null);

  fmt = day;
  private byStage = computed(() => {
    const map = new Map<number, StageTask[]>();
    for (const t of this.tasks()) (map.get(t.stageId) ?? map.set(t.stageId, []).get(t.stageId)!).push(t);
    return map;
  });
  tasksOf(stageId: number) { return this.byStage().get(stageId) ?? []; }
  /** مهام في المرحلة لا تظهر لي (عددها الكلي أكبر مما يصلني) — لا يكون إلا لمن لا يرى المشروع كاملاً */
  hidden(s: ProjectStage) { return !this.project().canViewFull && s.tasksTotal > this.tasksOf(s.id).length; }

  done(message: string) { this.toast.success(message); this.changed.emit(); }

  private run<T>(call: Observable<T>, message: string) {
    this.busy.set(true); this.error.set('');
    call.subscribe({
      next: () => { this.busy.set(false); this.done(message); },
      error: e => { this.busy.set(false); this.error.set(e.message ?? 'تعذّر تنفيذ الإجراء'); this.changed.emit(); }
    });
  }

  async close(s: ProjectStage) {
    if (!await this.confirm.ask(`إغلاق المرحلة «${s.stageTypeName}»؟ يجب إنجاز كل مهامها وإغلاق ما قبلها.`, 'إغلاق')) return;
    this.run(this.service.closeStage(s.id), 'أُغلقت المرحلة');
  }
  async reopen(s: ProjectStage) {
    if (!await this.confirm.ask(`إعادة فتح المرحلة «${s.stageTypeName}»؟`, 'إعادة فتح')) return;
    this.run(this.service.reopenStage(s.id), 'أُعيد فتح المرحلة');
  }
  async removeStage(s: ProjectStage) {
    if (!await this.confirm.ask(`حذف المرحلة «${s.stageTypeName}»؟ لا يمكن التراجع.`, 'حذف')) return;
    this.run(this.service.removeStage(s.id), 'حُذفت المرحلة');
  }
  async removeTask(t: StageTask) {
    if (!await this.confirm.ask(`حذف المهمة «${t.title}»؟ لا يمكن التراجع.`, 'حذف')) return;
    this.run(this.service.removeTask(t.id), 'حُذفت المهمة');
  }
  /** تقديم/تأخير مرحلة: المراحل المغلقة ومراحل المستندات تبقى في مكانها ويُرسل الترتيب الجديد كاملاً */
  move(s: ProjectStage, step: -1 | 1) {
    const ids = this.project().stages.map(x => x.id);
    const i = ids.indexOf(s.id), j = i + step;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.run(this.service.reorderStages(this.project().id, ids), 'تغيّر ترتيب المراحل');
  }
}
