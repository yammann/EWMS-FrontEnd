import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AssignedTaskService } from '@core/services/assigned-task.service';
import { TASK_ATTACHMENTS, TaskAttachment, attachmentProblem } from '@core/models/assigned-task.models';
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
  template: `
    @if (attachments().length) {
      <ul class="files">
        @for (a of attachments(); track a.id) {
          <li>
            <button type="button" class="file" (click)="open(a)" [title]="canPreview(a) ? 'معاينة ' + a.fileName : 'تنزيل ' + a.fileName">
              <span class="ico" aria-hidden="true">{{ icon(a.contentType) }}</span>
              <span class="meta"><span class="name">{{ a.fileName }}</span><small>{{ size(a.size) }} · {{ a.uploadedByName }}</small></span>
            </button>
            @if (a.canDelete && !readonly()) {
              <button type="button" class="del" (click)="remove(a)" [disabled]="busy()" [attr.aria-label]="'حذف ' + a.fileName" title="حذف">🗑</button>
            }
          </li>
        }
      </ul>
    } @else if (readonly() || !canAttach()) {
      <p class="muted">لا توجد مرفقات.</p>
    }

    @if (canAttach() && !readonly()) {
      <div class="drop" [class.over]="over()" (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="dropped($event)">
        <input #picker type="file" multiple hidden [accept]="accept" (change)="picked($event)">
        <button type="button" class="btn btn-ghost btn-sm" (click)="picker.click()" [disabled]="busy() || remaining() <= 0">
          {{ busy() ? progressText() || 'جارٍ الرفع…' : '+ إرفاق ملف' }}</button>
        <small>{{ remaining() > 0 ? 'أو اسحب الملفات إلى هنا — PDF وصور وWord وExcel وPowerPoint حتى 10MB (متبقٍّ ' + remaining() + ' من ' + max + ')' : 'بلغت الحد الأقصى ' + max + ' ملفات' }}</small>
      </div>
    }
    @if (problem()) { <p class="alert alert-error problem" role="alert">{{ problem() }}</p> }

    @if (current(); as a) {
      <app-modal [heading]="a.fileName" size="lg" (closed)="close()">
        <div class="modal-body viewer">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @else if (!url()) { <p class="muted" role="status">جارٍ التحميل…</p> }
          @else if (a.contentType === 'application/pdf') { <iframe [src]="safeUrl()" title="معاينة الملف"></iframe> }
          @else { <img [src]="safeUrl()" [alt]="a.fileName"> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close()">إغلاق</button>
          <button type="button" (click)="download(a)" [disabled]="!url()">تنزيل</button>
        </footer>
      </app-modal>
    }`,
  styles: [`
    .files { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 6px; }
    .files li { display: flex; align-items: center; gap: 6px; }
    .file { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 44px; padding: 6px 12px; text-align: start;
      border-radius: var(--radius-md); background: var(--fill); color: var(--ink-800); box-shadow: none; font-weight: 600; font-size: 13px; }
    .file:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .ico { font-size: 20px; flex: none; }
    .meta { display: grid; min-width: 0; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta small { color: var(--ink-500); font-weight: 400; font-size: 11.5px; }
    .del { min-height: 36px; width: 36px; padding: 0; border-radius: var(--radius-md); background: transparent; color: var(--danger-700); box-shadow: none; }
    .del:hover:not(:disabled) { background: var(--danger-50); transform: none; box-shadow: none; }
    .drop { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); }
    .drop.over { background: var(--brand-50); border-color: var(--brand-600); }
    .drop small { color: var(--ink-500); font-size: 11.5px; }
    .problem { margin: 8px 0 0; }
    .muted { margin: 0; color: var(--ink-500); font-size: 13px; }
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: #fff; }
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
  `]
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
