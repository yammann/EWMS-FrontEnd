import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignedTaskService } from '../../core/services/assigned-task.service';
import { Observable } from 'rxjs';
import { AssignedTaskDetail, TaskAttachment, TaskStatus, TASK_STATUS_LABEL } from '../../core/models/assigned-task.models';
import { hasOpenModal } from '../../shared/ui/modal';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TaskAttachments } from './task-attachments';
import { TaskNoteDialog } from './task-note-dialog';

/** لوحة جانبية بتفاصيل المهمة: الحالة، الوصف، قائمة التحقق، المرفقات، المهام الفرعية، السجل والتعليقات */
@Component({
  selector: 'app-task-detail-drawer', standalone: true, imports: [CommonModule, FormsModule, TaskAttachments, TaskNoteDialog],
  template: `
    <div class="drawer-backdrop" (click)="close.emit()"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
      @if (task(); as t) {
        <header class="drawer-head">
          <div class="chips">
            <span class="chip prio p-{{ t.priority }}">{{ t.priorityAr }}</span>
            <span class="chip st s-{{ t.status }}">{{ t.statusAr }}</span>
            @if (t.isOverdue) { <span class="chip overdue">متأخرة</span> }
          </div>
          <button type="button" class="icon-close" aria-label="إغلاق" (click)="close.emit()">×</button>
        </header>

        <div class="drawer-body">
          <h2 id="task-drawer-title">{{ t.title }}</h2>
          @if (t.parentTaskId) {
            <button type="button" class="link-btn" (click)="openTask.emit(t.parentTaskId)">↰ جزء من: {{ t.parentTitle }}</button>
          }

          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

          @if (t.canChangeStatus || t.allowedStatuses.length) {
            <div class="status-switch" role="radiogroup" aria-label="حالة المهمة">
              @for (s of statuses; track s) {
                <button type="button" class="s-{{ s }}" role="radio" [attr.aria-checked]="t.status === s" [class.on]="t.status === s"
                        [disabled]="busy() || (t.status !== s && !t.allowedStatuses.includes(s))" (click)="setStatus(s)">{{ statusLabel[s] }}</button>
              }
            </div>
            @if (t.status === 'InReview') {
              <p class="hint-line">{{ t.needsReturnNote ? 'بانتظار اعتمادك: اعتمدها «تم التنفيذ» أو أعدها للتنفيذ مع ذكر السبب.' : 'أُرسلت للمراجعة، بانتظار اعتماد المُسنِد.' }}</p>
            }
          }

          @if (t.claimedByName || t.canClaim || t.canRelease) {
            <div class="claim-row">
              @if (t.claimedByName) { <span>يعمل عليها: <strong>{{ t.claimedByName }}</strong></span> }
              @else { <span class="muted">لم يتولَّها أحد بعد</span> }
              @if (t.canClaim) { <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="claim(true)">أتولّى هذه المهمة</button> }
              @if (t.canRelease) { <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy()" (click)="claim(false)">تخلّي عنها</button> }
            </div>
          }

          <dl class="meta">
            <div><dt>مُسندة إلى</dt><dd>{{ t.targetName }}<small>{{ t.targetPath }}</small></dd></div>
            <div><dt>المُسنِد</dt><dd>{{ t.createdByName }}<small>{{ t.createdAt | date:'yyyy/MM/dd' }}</small></dd></div>
            <div><dt>تاريخ التسليم</dt><dd [class.late]="t.isOverdue">{{ t.dueDate ? (t.dueDate | date:'yyyy/MM/dd') : 'بدون موعد' }}</dd></div>
            <div><dt>الإنجاز</dt><dd>{{ t.completedAt ? (t.completedAt | date:'yyyy/MM/dd') : (t.startedAt ? 'بدأت ' + (t.startedAt | date:'MM/dd') : '—') }}</dd></div>
          </dl>

          <section>
            <h3>الوصف</h3>
            <p class="desc">{{ t.description || 'لا يوجد وصف' }}</p>
          </section>

          @if (t.checklist.length || t.canManageChecklist) {
            <section>
              <h3>قائمة التحقق @if (t.checklist.length) { <small>{{ doneCount(t) }} من {{ t.checklist.length }}</small> }</h3>
              @if (t.checklist.length) { <div class="progress" aria-hidden="true"><span [style.width.%]="100 * doneCount(t) / t.checklist.length"></span></div> }
              <ul class="checklist">
                @for (i of t.checklist; track i.id) {
                  <li [class.done]="i.isDone">
                    <label><input type="checkbox" [checked]="i.isDone" [disabled]="busy() || !t.canManageChecklist" (change)="toggleItem(i.id, $any($event.target).checked)">
                      <span>{{ i.text }}</span></label>
                    @if (t.canManageChecklist) {
                      <button type="button" class="x" [disabled]="busy()" (click)="removeItem(i.id)" [attr.aria-label]="'حذف ' + i.text" title="حذف">×</button>
                    }
                  </li>
                } @empty { <li class="muted">لا توجد بنود بعد.</li> }
              </ul>
              @if (t.canManageChecklist && t.checklist.length < maxChecklist) {
                <form class="inline-form" (ngSubmit)="addItem()">
                  <label class="sr-only" for="task-check-item">بند جديد</label>
                  <input id="task-check-item" name="item" maxlength="200" [(ngModel)]="newItem" placeholder="أضف بنداً…" autocomplete="off">
                  <button type="submit" class="btn btn-sm" [disabled]="busy() || !newItem.trim()">إضافة</button>
                </form>
              }
            </section>
          }

          @if (t.attachments.length || t.canAttach || t.parentAttachments.length) {
            <section>
              <h3>المرفقات @if (t.attachments.length) { <small>{{ t.attachments.length }}</small> }</h3>
              <app-task-attachments [attachments]="t.attachments" [canAttach]="t.canAttach" [busy]="uploading()" [progressText]="progress()"
                (upload)="upload($event)" (removed)="removeAttachment($event)" />
              @if (t.parentAttachments.length) {
                <h3 class="sub-h">مرفقات المهمة الأصل (للاطلاع)</h3>
                <app-task-attachments [attachments]="t.parentAttachments" [readonly]="true" />
              }
            </section>
          }

          @if (t.subTasks.length || t.canDelegate) {
            <section>
              <div class="sec-head">
                <h3>المهام الفرعية @if (t.subTasksTotal) { <small>{{ t.subTasksDone }} من {{ t.subTasksTotal }} منجزة</small> }</h3>
                @if (t.canDelegate) { <button type="button" class="btn btn-sm" (click)="delegate.emit(t)">+ تفويض</button> }
              </div>
              @if (t.subTasksTotal) { <div class="progress" aria-hidden="true"><span [style.width.%]="100 * t.subTasksDone / t.subTasksTotal"></span></div> }
              <ul class="subtasks">
                @for (s of t.subTasks; track s.id) {
                  <li><button type="button" (click)="openTask.emit(s.id)">
                    <span class="chip st s-{{ s.status }}">{{ s.statusAr }}</span>
                    <span class="st-title">{{ s.title }}</span>
                    <small>{{ s.targetName }}</small>
                  </button></li>
                } @empty { <li class="muted">لم تُفوَّض مهام فرعية بعد.</li> }
              </ul>
            </section>
          }

          <section>
            <h3>السجل والتعليقات</h3>
            <ol class="timeline">
              @for (a of t.activities; track a.id) {
                <li [class.comment]="a.type === 'Comment'">
                  <span class="dot" aria-hidden="true">{{ icon(a.type) }}</span>
                  <div>
                    <p><strong>{{ a.userName }}</strong> @if (a.type !== 'Comment') { {{ a.text }} }</p>
                    @if (a.type === 'Comment') { <p class="comment-text">{{ a.text }}</p> }
                    <time>{{ a.createdAt | date:'yyyy/MM/dd HH:mm' }}</time>
                  </div>
                </li>
              }
            </ol>
            @if (t.canComment) {
              <form class="comment-form" (ngSubmit)="addComment()">
                <label class="sr-only" for="task-comment">تعليق</label>
                <textarea id="task-comment" name="comment" rows="2" maxlength="2000" [(ngModel)]="comment" placeholder="اكتب تعليقاً أو تحديثاً…"></textarea>
                <button type="submit" class="btn btn-sm" [disabled]="busy() || !comment.trim()">إرسال</button>
              </form>
            }
          </section>
        </div>

        @if (t.canEdit || t.canDelete) {
          <footer class="drawer-foot">
            @if (confirmDelete()) {
              <span>حذف المهمة نهائياً؟</span>
              <button type="button" class="btn btn-danger btn-sm" (click)="remove()" [disabled]="busy()">تأكيد الحذف</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="confirmDelete.set(false)">تراجع</button>
            } @else {
              @if (t.canEdit) { <button type="button" class="btn btn-ghost btn-sm" (click)="edit.emit(t)">تعديل</button> }
              @if (t.canDelete) { <button type="button" class="btn btn-danger btn-sm" (click)="confirmDelete.set(true)">حذف</button> }
            }
          </footer>
        }
      } @else if (error()) {
        <div class="drawer-body"><p class="alert alert-error" role="alert">{{ error() }}</p><button class="btn btn-ghost" (click)="close.emit()">إغلاق</button></div>
      } @else {
        <div class="drawer-body"><p class="muted" role="status">جارٍ التحميل…</p></div>
      }
    </aside>
    @if (returning()) {
      <app-task-note-dialog heading="إعادة المهمة للتنفيذ" [subheading]="task()?.title ?? ''" [busy]="busy()"
        (confirm)="applyStatus('InProgress', $event)" (cancel)="returning.set(false)" />
    }`,
  styleUrl: './task-detail-drawer.scss'
})
export class TaskDetailDrawer {
  private service = inject(AssignedTaskService);
  private confirm = inject(ConfirmService);

  taskId = input.required<number>();
  close = output<void>();
  changed = output<void>();
  edit = output<AssignedTaskDetail>();
  delegate = output<AssignedTaskDetail>();
  openTask = output<number>();

  task = signal<AssignedTaskDetail | null>(null);
  error = signal('');
  busy = signal(false);
  confirmDelete = signal(false);
  comment = '';
  newItem = '';
  maxChecklist = 30;
  returning = signal(false);
  uploading = signal(false);
  progress = signal('');
  statuses: TaskStatus[] = ['Todo', 'InProgress', 'InReview', 'Done'];
  statusLabel = TASK_STATUS_LABEL;

  constructor() {
    effect(() => { const id = this.taskId(); this.load(id); });
  }

  @HostListener('document:keydown.escape')
  onEscape() { if (!hasOpenModal()) this.close.emit(); }   // نافذة فوق اللوحة تُغلق وحدها أولاً

  load(id = this.taskId()) {
    this.error.set(''); this.confirmDelete.set(false);
    this.service.get(id).subscribe({
      next: t => this.task.set(t),
      error: e => { this.task.set(null); this.error.set(e.message); }
    });
  }

  async setStatus(status: TaskStatus) {
    const t = this.task();
    if (!t || t.status === status || this.busy()) return;
    // إعادة من المراجعة بيد المُسنِد: السبب إجباري
    if (t.status === 'InReview' && status === 'InProgress' && t.needsReturnNote) { this.returning.set(true); return; }
    if (status === 'Done' && !(await this.confirm.ask('اعتماد المهمة «تم التنفيذ»؟ تُقفل بعدها ولا يمكن تغييرها.', 'اعتماد'))) return;
    this.applyStatus(status);
  }

  applyStatus(status: TaskStatus, note?: string) {
    const t = this.task();
    if (!t || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.changeStatus(t.id, status, note).subscribe({
      next: () => { this.busy.set(false); this.returning.set(false); this.load(); this.changed.emit(); },
      error: e => { this.busy.set(false); this.returning.set(false); this.error.set(e.message); }
    });
  }

  /** ينفّذ طلباً يعيد تفصيل المهمة المحدَّث */
  private run(request: Observable<AssignedTaskDetail>, after?: () => void) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    request.subscribe({
      next: updated => { this.busy.set(false); this.task.set(updated); this.changed.emit(); after?.(); },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }

  doneCount = (t: AssignedTaskDetail) => t.checklist.filter(i => i.isDone).length;
  addItem() {
    const t = this.task(), text = this.newItem.trim();
    if (t && text) this.run(this.service.addChecklistItem(t.id, text), () => this.newItem = '');
  }
  toggleItem(id: number, isDone: boolean) { this.run(this.service.updateChecklistItem(id, { isDone })); }
  removeItem(id: number) { this.run(this.service.deleteChecklistItem(id)); }
  claim(claim: boolean) { const t = this.task(); if (t) this.run(this.service.claim(t.id, claim)); }

  upload(files: File[]) {
    const t = this.task();
    if (!t || this.uploading()) return;
    this.uploading.set(true); this.error.set(''); this.progress.set(files.length > 1 ? `0 من ${files.length}` : '');
    this.service.attachSequentially(t.id, files, (done, total) => this.progress.set(total > 1 ? `${done} من ${total}` : '')).subscribe({
      next: updated => { this.uploading.set(false); this.progress.set(''); this.task.set(updated); this.changed.emit(); },
      error: e => { this.uploading.set(false); this.progress.set(''); this.error.set(e.message); this.load(); this.changed.emit(); }
    });
  }

  removeAttachment(a: TaskAttachment) { this.run(this.service.deleteAttachment(a.id)); }

  addComment() {
    const t = this.task();
    const text = this.comment.trim();
    if (!t || !text || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.comment(t.id, text).subscribe({
      next: updated => { this.busy.set(false); this.comment = ''; this.task.set(updated); this.changed.emit(); },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }

  remove() {
    const t = this.task();
    if (!t || this.busy()) return;
    this.busy.set(true);
    this.service.delete(t.id).subscribe({
      next: () => { this.busy.set(false); this.changed.emit(); this.close.emit(); },
      error: e => { this.busy.set(false); this.error.set(e.message); this.confirmDelete.set(false); }
    });
  }

  icon(type: string) {
    return ({ Created: '✚', StatusChanged: '⇄', Comment: '💬', Delegated: '↳', Edited: '✎', Attached: '📎', AttachmentRemoved: '🗑', Claimed: '✋', Released: '↩' } as Record<string, string>)[type] ?? '•';
  }
}
