import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { fileSize } from '@core/utils/file-size';
import { errorMessage } from '@shared/ui/error-message';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { MapEntryFile } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';

/** أيقونة حسب مجموعة الصيغة */
export function kindIcon(kind: string): string {
  return ({ images: '🖼', pdf: '📄', office: '📝', text: '🧾', cad: '📐', maps: '🗺', archives: '🗜', media: '🎞' } as Record<string, string>)[kind] ?? '📎';
}

/**
 * ملفات حقل في سجل طبقة: الصور وPDF تُعاين داخل نافذة، وباقي الصيغ تُنزَّل مباشرة.
 * الملف يُجلب كـ Blob (عبر معترض رمز الدخول)، ولا يُفتح شيء غير الصورة/PDF داخل الصفحة.
 */
@Component({
  selector: 'app-entry-files', standalone: true, imports: [Modal],
  template: `
    <ul class="files">
      @for (f of files(); track f.id) {
        <li>
          <button type="button" class="file" (click)="open(f)" [title]="(f.previewable ? 'معاينة ' : 'تنزيل ') + f.fileName" [disabled]="busyId() === f.id">
            <span class="ico" aria-hidden="true">{{ icon(f.kind) }}</span>
            <span class="meta"><span class="name">{{ f.fileName }}</span><small>{{ size(f.size) }}{{ f.previewable ? '' : ' · تنزيل' }}</small></span>
          </button>
        </li>
      } @empty { <li class="none">—</li> }
    </ul>

    @if (current(); as f) {
      <app-modal [heading]="f.fileName" size="lg" (closed)="close()">
        <div class="modal-body viewer">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @else if (!url()) { <p class="muted" role="status">جارٍ التحميل…</p> }
          @else if (f.contentType === 'application/pdf') { <iframe [src]="safeUrl()" title="معاينة الملف"></iframe> }
          @else { <img [src]="safeUrl()" [alt]="f.fileName"> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close()">إغلاق</button>
          <button type="button" (click)="download(f)" [disabled]="!url()">تنزيل</button>
        </footer>
      </app-modal>
    }`,
  styles: [`
    .files { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .file { display: inline-flex; align-items: center; gap: 8px; max-width: 280px; min-height: 36px; padding: 4px 10px; text-align: start;
      border-radius: var(--radius-md); background: var(--fill); color: var(--ink-800); box-shadow: none; font-weight: 600; font-size: 12.5px; }
    .file:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .ico { font-size: 16px; flex: none; }
    .meta { display: grid; min-width: 0; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta small { color: var(--ink-500); font-weight: 400; font-size: 11px; }
    .none { color: var(--ink-500); }
    .muted { margin: 0; color: var(--ink-500); font-size: 13px; }
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: var(--surface); }
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
  `]
})
export class EntryFiles implements OnDestroy {
  private service = inject(MapLayersService);
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);

  files = input<MapEntryFile[]>([]);

  size = fileSize;
  icon = kindIcon;
  current = signal<MapEntryFile | null>(null);
  url = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  error = signal('');
  /** ملف يُنزَّل الآن (بلا معاينة) */
  busyId = signal<number | null>(null);

  open(f: MapEntryFile) {
    this.release();
    this.error.set('');
    if (!f.previewable) { this.fetchAndSave(f); return; }
    this.current.set(f);
    this.service.fileBlob(f.id).subscribe({
      next: blob => {
        if (this.current()?.id !== f.id) return;
        const url = URL.createObjectURL(new Blob([blob], { type: f.contentType }));
        this.url.set(url);
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: e => this.error.set(errorMessage(e, 'تعذر فتح الملف'))
    });
  }

  private fetchAndSave(f: MapEntryFile) {
    this.busyId.set(f.id);
    this.service.fileBlob(f.id).subscribe({
      next: blob => { this.busyId.set(null); this.save(URL.createObjectURL(blob), f.fileName, true); },
      error: e => { this.busyId.set(null); this.toast.error(errorMessage(e, 'تعذر تنزيل الملف')); }
    });
  }

  download(f: MapEntryFile) {
    const url = this.url();
    if (url) this.save(url, f.fileName, false);
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
