import { Component, inject, input, output, signal } from '@angular/core';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { TASK_ATTACHMENTS, TaskAttachment, attachmentProblem } from '../data-access/assigned-task.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { saveBlob } from '@core/utils/download';
import { fileSize } from '@core/utils/file-size';
import { errorMessage } from '@shared/ui/error-message';
import { FilePreview, isPreviewable } from '@shared/ui/file-preview';
import { Icon, IconName } from '@shared/ui/icon';
import { ActionIcon } from '@shared/ui/action-icon';
import { ToastService } from '@shared/ui/toast.service';
import { ActionButton } from '@shared/ui/action-button';

/** أيقونة حسب نوع الملف */
export function fileIcon(contentType: string): IconName {
  if (contentType.startsWith('image/')) return 'photo';
  if (contentType.includes('sheet') || contentType.includes('excel')) return 'table';
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'presentation';
  return 'docText';
}

/**
 * مرفقات المهمة: قائمة بمعاينة (صورة/PDF داخل نافذة — `app-file-preview`) وتنزيل (ملفات Office تُنزَّل)، وحذف،
 * ورفع بالاختيار أو السحب والإفلات.
 * الرفع من هنا يُرسل الملفات إلى الأب (upload) ليتولى الطلب، فيبقى المكوّن بلا اعتماد على المهمة نفسها.
 * قائمة «readonly» (مرفقات الأصل) بلا حذف ولا رفع.
 */
@Component({
  selector: 'app-task-attachments', imports: [ActionButton, FilePreview, Icon, ActionIcon],
  templateUrl: './task-attachments.html',
  styleUrl: './task-attachments.scss'
})
export class TaskAttachments {
  private service = inject(AssignedTaskService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  attachments = input<TaskAttachment[]>([]);
  canAttach = input(false);
  readonly = input(false);
  busy = input(false);
  /** نص تقدّم رفع عدة ملفات («2 من 5») يعرضه الأب */
  progressText = input('');
  upload = output<File[]>();
  removed = output<TaskAttachment>();

  max = TASK_ATTACHMENTS.maxFiles;
  accept = TASK_ATTACHMENTS.accept;
  size = fileSize;
  icon = fileIcon;
  over = signal(false);
  problem = signal('');
  remaining = () => Math.max(0, this.max - this.attachments().length);

  current = signal<TaskAttachment | null>(null);
  blob = (id: number) => this.service.attachmentBlob(id);

  canPreview = (a: TaskAttachment) => isPreviewable(a.contentType);

  picked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.take([...(input.files ?? [])]);
    input.value = '';
  }

  dropped(event: DragEvent) {
    event.preventDefault(); this.over.set(false);
    if (this.canAttach() && !this.busy()) this.take([...(event.dataTransfer?.files ?? [])]);
  }

  private take(files: File[]) {
    this.problem.set('');
    if (!files.length) return;
    if (files.length > this.remaining()) { this.problem.set(`المتاح ${this.remaining()} ملفات فقط (الحد ${this.max} للمهمة)`); return; }
    const bad = files.map(attachmentProblem).find(p => p);
    if (bad) { this.problem.set(bad); return; }
    this.upload.emit(files);
  }

  async remove(a: TaskAttachment) {
    if (await this.confirm.ask(`حذف المرفق «${a.fileName}»؟`, 'حذف', 'تأكيد الإجراء', 'delete')) this.removed.emit(a);
  }

  /** صور وPDF تُعاين داخل نافذة، وغيرها (Office) يُنزَّل مباشرة */
  open(a: TaskAttachment) {
    if (this.canPreview(a)) { this.current.set(a); return; }
    this.service.attachmentBlob(a.id).subscribe({
      next: blob => saveBlob(new Blob([blob], { type: a.contentType }), a.fileName),
      error: e => this.toast.error(errorMessage(e, 'تعذر تنزيل الملف'))
    });
  }
}
