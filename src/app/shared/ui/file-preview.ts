import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { saveBlob } from '@core/utils/download';
import { errorMessage } from './error-message';
import { Modal } from './modal';

/** ما تحتاجه المعاينة من أي مرفق (مهمة، إجازة، دراسة، ملف طبقة) */
export interface PreviewFile { id: number; fileName: string; contentType: string; }

/** الصيغ التي تُعرض داخل الصفحة: PDF وصور فقط؛ ما عداها يُنزَّل */
export const isPreviewable = (contentType: string) => contentType === 'application/pdf' || contentType.startsWith('image/');

/**
 * معاينة مرفق داخل نافذة: `<app-file-preview [file]="current()" [load]="blob" (closed)="current.set(null)" />`.
 * - الملف يُجلب عبر الـ API مع رمز الدخول (`load(id)`)، ثم يُعرض من رابط blob: محلي يُحرَّر عند الإغلاق أو تغيّر الملف.
 * - PDF وحده في iframe، وغيره في img (لا يُنفَّذ فيه سكربت — حتى لو كان SVG).
 * - «تنزيل» يحفظ المحتوى المعروض، أو يستدعي `save` إن مُرّر (تنزيل تدفقاً إلى القرص مثلاً).
 */
@Component({
  selector: 'app-file-preview', imports: [Modal],
  template: `
    @if (file(); as f) {
      <app-modal [heading]="f.fileName" size="lg" (closed)="closed.emit()">
        <div class="modal-body viewer">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @else if (!safeUrl()) { <p class="muted" role="status">جارٍ التحميل…</p> }
          @else if (f.contentType === 'application/pdf') { <iframe [src]="safeUrl()" title="معاينة الملف"></iframe> }
          @else { <img [src]="safeUrl()" [alt]="f.fileName"> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()">إغلاق</button>
          <button type="button" (click)="download()" [disabled]="!save() && !content()">تنزيل</button>
        </footer>
      </app-modal>
    }`,
  styles: [`
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: #fff; } /* raw-color-ok: ورق ملف PDF */
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
    .muted { margin: 0; color: var(--ink-500); font-size: 13px; }
  `]
})
export class FilePreview {
  private sanitizer = inject(DomSanitizer);

  /** الملف المعروض؛ null = النافذة مغلقة */
  file = input<PreviewFile | null>(null);
  /** يجلب محتوى الملف بمعرّفه */
  load = input.required<(id: number) => Observable<Blob>>();
  /** تنزيل خاص بالمكان؛ بدونه يُحفظ المحتوى المعروض نفسه */
  save = input<(() => void) | null>(null);
  closed = output<void>();

  protected content = signal<Blob | null>(null);
  protected safeUrl = signal<SafeResourceUrl | null>(null);
  protected error = signal('');
  private objectUrl: string | null = null;

  constructor() {
    effect(onCleanup => {
      const f = this.file();
      const load = this.load();
      untracked(() => this.release());
      if (!f) return;
      const sub = untracked(() => load(f.id).subscribe({
        next: data => {
          const blob = new Blob([data], { type: f.contentType });
          this.objectUrl = URL.createObjectURL(blob);
          this.content.set(blob);
          this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        },
        error: e => this.error.set(errorMessage(e, 'تعذر فتح الملف'))
      }));
      onCleanup(() => sub.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  protected download() {
    const save = this.save();
    if (save) { save(); return; }
    const blob = this.content(), f = this.file();
    if (blob && f) saveBlob(blob, f.fileName);
  }

  private release() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.content.set(null); this.safeUrl.set(null); this.error.set('');
  }
}
