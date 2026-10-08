import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { TASK_ATTACHMENTS, TaskAttachment, attachmentProblem } from '../data-access/assigned-task.models';
import { Modal } from '@shared/ui/modal';
import { ConfirmService } from '@shared/ui/confirm.service';
import { fileSize } from '@core/utils/file-size';

/** أيقونة حسب نوع الملف */
export function fileIcon(contentType: string): string {
  if (contentType === 'application/pdf') return '📄';
  if (contentType.startsWith('image/')) return '🖼';
  if (contentType.includes('sheet') || contentType.includes('excel')) return '📊';
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📽';
  return '📝';
}

/**
 * مرفقات المهمة: قائمة بمعاينة (صورة/PDF داخل نافذة) وتنزيل (ملفات Office تُنزَّل)، وحذف، ورفع بالاختيار أو السحب والإفلات.
 * الرفع من هنا يُرسل الملفات إلى الأب (upload) ليتولى الطلب، فيبقى المكوّن بلا اعتماد على المهمة نفسها.
 * قائمة «readonly» (مرفقات الأصل) بلا حذف ولا رفع.
 */
@Component({
  selector: 'app-task-attachments', standalone: true, imports: [Modal],
  templateUrl: './task-attachments.html',
  styleUrl: './task-attachments.scss'
})
export class TaskAttachments implements OnDestroy {
  private service = inject(AssignedTaskService);
  private sanitizer = inject(DomSanitizer);
  private confirm = inject(ConfirmService);

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
  url = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  error = signal('');

  canPreview = (a: TaskAttachment) => a.contentType === 'application/pdf' || a.contentType.startsWith('image/');

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
    if (await this.confirm.ask(`حذف المرفق «${a.fileName}»؟`, 'حذف')) this.removed.emit(a);
  }

  /** صور وPDF تُعاين داخل نافذة، وغيرها (Office) يُنزَّل مباشرة */
  open(a: TaskAttachment) {
    this.release();
    this.error.set('');
    if (!this.canPreview(a)) { this.fetch(a, true); return; }
    this.current.set(a);
    this.fetch(a, false);
  }

  private fetch(a: TaskAttachment, thenDownload: boolean) {
    this.service.attachmentBlob(a.id).subscribe({
      next: blob => {
        if (thenDownload) { this.save(URL.createObjectURL(new Blob([blob], { type: a.contentType })), a.fileName, true); return; }
        if (this.current()?.id !== a.id) return;
        const url = URL.createObjectURL(new Blob([blob], { type: a.contentType }));
        this.url.set(url);
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: e => { this.current.set(a); this.error.set(e.message); }
    });
  }

  download(a: TaskAttachment) {
    const url = this.url();
    if (url) this.save(url, a.fileName, false);
  }

  private save(url: string, name: string, revoke: boolean) {
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  close() { this.current.set(null); this.release(); }

  private release() {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set(null); this.safeUrl.set(null);
  }

  ngOnDestroy() { this.release(); }
}
