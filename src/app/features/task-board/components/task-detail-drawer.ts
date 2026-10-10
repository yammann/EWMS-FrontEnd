import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { Observable } from 'rxjs';
import { AssignedTaskDetail, TaskAttachment, TaskStatus, TASK_STATUS_LABEL } from '../data-access/assigned-task.models';
import { hasOpenModal } from '@shared/ui/modal';
import { ConfirmService } from '@shared/ui/confirm.service';
import { TaskAttachments } from './task-attachments';
import { TaskLinks } from './task-links';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { ToastService } from '@shared/ui/toast.service';
import { AddToTodoDialog } from '@features/todo';
import { TaskNoteDialog } from './task-note-dialog';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/track-request';

/** لوحة جانبية بتفاصيل المهمة: الحالة، الوصف، قائمة التحقق، المرفقات، المهام الفرعية، السجل والتعليقات */
@Component({
  selector: 'app-task-detail-drawer', standalone: true, imports: [Alert, CommonModule, FormsModule, TaskAttachments, TaskNoteDialog, TaskLinks, AddToTodoDialog],
  templateUrl: './task-detail-drawer.html',
  styleUrl: './task-detail-drawer.scss'
})
export class TaskDetailDrawer {
  private service = inject(AssignedTaskService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  taskId = input.required<number>();
  closed = output<void>();
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
  todoOpen = signal(false);
  canTodo = () => this.auth.hasPermission(AppPermission.EditToDoList) && this.auth.hasPermission(AppPermission.ViewToDoLists);
  todoAdded() { this.todoOpen.set(false); this.toast.success('أُضيفت المهمة إلى مفكرتي'); }
  uploading = signal(false);
  progress = signal('');
  statuses: TaskStatus[] = ['Todo', 'InProgress', 'InReview', 'Done'];
  statusLabel = TASK_STATUS_LABEL;

  constructor() {
    effect(() => { const id = this.taskId(); this.load(id); });
  }

  @HostListener('document:keydown.escape')
  onEscape() { if (!hasOpenModal()) this.closed.emit(); }   // نافذة فوق اللوحة تُغلق وحدها أولاً

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
    this.service.changeStatus(t.id, status, note, t.status).subscribe({
      next: () => { this.busy.set(false); this.returning.set(false); this.load(); this.changed.emit(); },
      // رفض الخادم (ومنه: غيّرها مستخدم آخر للتو) ← إعادة قراءة المهمة لتظهر حالتها الفعلية مع الرسالة
      error: e => { this.busy.set(false); this.returning.set(false); this.load(); this.error.set(e.message); }
    });
  }

  /** ينفّذ طلباً يعيد تفصيل المهمة المحدَّث */
  private run(request: Observable<AssignedTaskDetail>, after?: () => void) {
    if (this.busy()) return;
    trackRequest(request, this.busy, this.error, updated => { this.task.set(updated); this.changed.emit(); after?.(); });
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
    trackRequest(this.service.comment(t.id, text), this.busy, this.error, updated => { this.comment = ''; this.task.set(updated); this.changed.emit(); });
  }

  remove() {
    const t = this.task();
    if (!t || this.busy()) return;
    this.busy.set(true);
    this.service.delete(t.id).subscribe({
      next: () => { this.busy.set(false); this.changed.emit(); this.closed.emit(); },
      error: e => { this.busy.set(false); this.error.set(e.message); this.confirmDelete.set(false); }
    });
  }

  icon(type: string) {
    return ({ Created: '✚', StatusChanged: '⇄', Comment: '💬', Delegated: '↳', Edited: '✎', Attached: '📎', AttachmentRemoved: '🗑', Claimed: '✋', Released: '↩' } as Record<string, string>)[type] ?? '•';
  }
}
