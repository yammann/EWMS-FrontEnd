import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VacationService } from '@core/services/vacation.service';
import { VacationAttachment } from '@core/models/vacation.models';
import { Modal } from '@shared/ui/modal';

/** حجم مقروء: 1.2 MB / 340 KB */
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * مرفقات طلب إجازة: قائمة، ومعاينة داخل نافذة (صورة أو PDF)، وتنزيل.
 * الملف يُجلب عبر الـ API مع رمز الدخول (لا رابط مفتوح)، ثم يُعرض من رابط محلي مؤقت يُحرَّر عند الإغلاق.
 */
@Component({
  selector: 'app-vacation-attachments', standalone: true, imports: [Modal],
  template: `
    @if (attachments().length) {
      <div class="att">
        <span class="label">المرفقات ({{ attachments().length }})</span>
        <div class="chips">
          @for (a of attachments(); track a.id) {
            <button type="button" class="chip" (click)="open(a)" [title]="'عرض ' + a.fileName">
              <span aria-hidden="true">{{ a.contentType === 'application/pdf' ? '📄' : '🖼' }}</span>
              <span class="name">{{ a.fileName }}</span><span class="size">{{ size(a.size) }}</span>
            </button>
          }
        </div>
      </div>
    }

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
    .att { display: grid; gap: 6px; margin: 8px 0; }
    .label { font-size: 12px; color: var(--ink-500); font-weight: 700; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; max-width: 100%; padding: 0 10px;
      border-radius: 999px; background: var(--fill); color: var(--ink-800); font-size: 12px; font-weight: 600; box-shadow: none; }
    .chip:hover:not(:disabled) { transform: none; background: var(--fill-strong); box-shadow: none; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
    .size { color: var(--ink-500); font-weight: 400; }
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: #fff; }
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
    .muted { color: var(--ink-500); }
  `]
})
export class VacationAttachments implements OnDestroy {
  private service = inject(VacationService);
  private sanitizer = inject(DomSanitizer);
  attachments = input<VacationAttachment[]>([]);

  current = signal<VacationAttachment | null>(null);
  url = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  error = signal('');
  size = fileSize;

  open(a: VacationAttachment) {
    this.release();
    this.current.set(a); this.error.set('');
    this.service.attachmentBlob(a.id).subscribe({
      next: blob => {
        if (this.current()?.id !== a.id) return;
        const url = URL.createObjectURL(new Blob([blob], { type: a.contentType }));
        this.url.set(url);
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: e => this.error.set(e.message)
    });
  }

  download(a: VacationAttachment) {
    const url = this.url(); if (!url) return;
    const link = document.createElement('a');
    link.href = url; link.download = a.fileName; link.click();
  }

  close() { this.current.set(null); this.release(); }

  private release() {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set(null); this.safeUrl.set(null);
  }

  ngOnDestroy() { this.release(); }
}
