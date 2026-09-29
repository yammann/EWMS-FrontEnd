import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignedTaskService } from '../../core/services/assigned-task.service';
import { AssignedTaskDetail, TaskStatus, TASK_STATUS_LABEL } from '../../core/models/assigned-task.models';
import { hasOpenModal } from '../../shared/ui/modal';

/** لوحة جانبية بتفاصيل المهمة: الحالة، الوصف، المهام الفرعية، السجل والتعليقات */
@Component({
  selector: 'app-task-detail-drawer', standalone: true, imports: [CommonModule, FormsModule],
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

          @if (t.canChangeStatus) {
            <div class="status-switch" role="radiogroup" aria-label="حالة المهمة">
              @for (s of statuses; track s) {
                <button type="button" class="s-{{ s }}" role="radio" [attr.aria-checked]="t.status === s" [class.on]="t.status === s"
                        [disabled]="busy()" (click)="setStatus(s)">{{ statusLabel[s] }}</button>
              }
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
    </aside>`,
  styleUrl: './task-detail-drawer.scss'
})
export class TaskDetailDrawer {
  private service = inject(AssignedTaskService);

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
  statuses: TaskStatus[] = ['Todo', 'InProgress', 'Done'];
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

  setStatus(status: TaskStatus) {
    const t = this.task();
    if (!t || t.status === status || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.changeStatus(t.id, status).subscribe({
      next: () => { this.busy.set(false); this.load(); this.changed.emit(); },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }

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
    return ({ Created: '✚', StatusChanged: '⇄', Comment: '💬', Delegated: '↳', Edited: '✎' } as Record<string, string>)[type] ?? '•';
  }
}
