import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VacationService } from '../data-access/vacation.service';
import { VacationAttachment } from '../data-access/vacation.models';
import { fileSize } from '@core/utils/file-size';
import { Modal } from '@shared/ui/modal';

/**
 * مرفقات طلب إجازة: قائمة، ومعاينة داخل نافذة (صورة أو PDF)، وتنزيل.
 * الملف يُجلب عبر الـ API مع رمز الدخول (لا رابط مفتوح)، ثم يُعرض من رابط محلي مؤقت يُحرَّر عند الإغلاق.
 */
@Component({
  selector: 'app-vacation-attachments', standalone: true, imports: [Modal],
  templateUrl: './vacation-attachments.html',
  styleUrl: './vacation-attachments.scss'
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
