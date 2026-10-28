import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { fileSize } from '@core/utils/file-size';
import { saveBlob } from '@core/utils/download';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { Correspondence, CorrespondenceAttachment } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

/**
 * مرفقات المعاملة: الكتب الممسوحة والملحقات ومسودة الصادر. PDF والصور تُعاينان داخل نافذة، وملفات Office تُنزَّل فقط.
 * الرفع لمن يحق له (canAttach من الخادم)، والحذف لمسودة الصادر فقط (الوارد وما بعد الاعتماد أثر لا يُمحى).
 */
@Component({
  selector: 'app-correspondence-attachments', standalone: true, imports: [Icon, Modal],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <section class="panel">
      <div class="panel-heading">
        <h2>المرفقات <span class="count">({{ item().attachments.length }})</span></h2>
        @if (item().canAttach) {
          <label class="btn btn-ghost pick">
            {{ busy() ? 'جارٍ الرفع…' : '+ إرفاق ملفات' }}
            <input type="file" multiple hidden [accept]="allowed" [disabled]="busy()" (change)="pick($event)">
          </label>
        }
      </div>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (!item().attachments.length) { <p class="muted">لا مرفقات بعد{{ item().canAttach ? ' — أرفق الكتاب الممسوح أو نصه' : '' }}.</p> }
      <ul class="files">
        @for (a of item().attachments; track a.id) {
          <li>
            <button type="button" class="file" (click)="open(a)" [title]="canPreview(a) ? 'عرض ' + a.fileName : 'تنزيل ' + a.fileName">
              <app-icon [name]="a.contentType === 'application/pdf' ? 'docText' : a.contentType.startsWith('image/') ? 'photo' : 'docText'" [size]="18" />
              <span class="name">{{ a.fileName }}</span>
              <small>{{ size(a.size) }} · {{ a.uploadedByName }}</small>
            </button>
            @if (canDelete()) { <button type="button" class="x" (click)="remove(a)" [attr.aria-label]="'حذف ' + a.fileName" title="حذف">×</button> }
          </li>
        }
      </ul>
    </section>

    @if (current(); as a) {
      <app-modal [heading]="a.fileName" size="lg" (closed)="close()">
        <div class="modal-body viewer">
          @if (viewError()) { <p class="alert alert-error" role="alert">{{ viewError() }}</p> }
          @else if (!url()) { <p class="muted" role="status">جارٍ التحميل…</p> }
          @else if (a.contentType === 'application/pdf') { <iframe [src]="safeUrl()" title="معاينة الملف"></iframe> }
          @else { <img [src]="safeUrl()" [alt]="a.fileName"> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close()">إغلاق</button>
          <button type="button" (click)="downloadCurrent(a)" [disabled]="!url()">تنزيل</button>
        </footer>
      </app-modal>
    }
  `,
  styles: [`
    .files { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
    .files li { display: flex; align-items: center; gap: 8px; }
    .file { display: inline-flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 8px 12px; border-radius: var(--radius-md);
      background: var(--fill); color: var(--ink-800); text-align: start; box-shadow: none; }
    .file:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .file .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .file small { margin-inline-start: auto; color: var(--ink-500); white-space: nowrap; }
    .x { min-width: 32px; padding: 0 8px; background: transparent; color: var(--danger, #c0392b); box-shadow: none; font-size: 20px; }
    .pick { cursor: pointer; }
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: #fff; }
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
    .muted { color: var(--ink-500); }
  `]
})
export class CorrespondenceAttachments implements OnDestroy {
  private service = inject(DiwanService);
  private sanitizer = inject(DomSanitizer);
  private confirm = inject(ConfirmService);

  item = input.required<Correspondence>();
  /** الخادم أعاد تفصيلاً محدَّثاً بعد رفع أو حذف */
  changed = output<Correspondence>();

  allowed = ALLOWED;
  size = fileSize;
  busy = signal(false);
  error = signal('');
  current = signal<CorrespondenceAttachment | null>(null);
  url = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  viewError = signal('');

  /** حذف المرفق لمسودة الصادر فقط، ولمن يحرّرها */
  canDelete = () => this.item().direction === 2 && this.item().outgoingState === 1 && this.item().canEdit;
  canPreview = (a: CorrespondenceAttachment) => a.contentType === 'application/pdf' || a.contentType.startsWith('image/');

  async pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length || this.busy()) return;

    const tooBig = files.find(f => f.size > MAX_BYTES);
    if (tooBig) { this.error.set(`الملف «${tooBig.name}» أكبر من 10MB`); return; }

    this.busy.set(true); this.error.set('');
    this.service.attach(this.item().id, files).subscribe({
      next: c => { this.busy.set(false); this.changed.emit(c); },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }

  open(a: CorrespondenceAttachment) {
    if (!this.canPreview(a)) { this.service.attachmentBlob(a.id, true).subscribe({ next: b => saveBlob(b, a.fileName), error: e => this.error.set(e.message) }); return; }
    this.release();
    this.current.set(a); this.viewError.set('');
    this.service.attachmentBlob(a.id).subscribe({
      next: blob => {
        if (this.current()?.id !== a.id) return;
        const url = URL.createObjectURL(new Blob([blob], { type: a.contentType }));
        this.url.set(url);
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: e => this.viewError.set(e.message)
    });
  }

  downloadCurrent(a: CorrespondenceAttachment) {
    const url = this.url(); if (!url) return;
    const link = document.createElement('a');
    link.href = url; link.download = a.fileName; link.click();
  }

  async remove(a: CorrespondenceAttachment) {
    if (!(await this.confirm.ask(`حذف المرفق «${a.fileName}» من المسودة؟`, 'حذف'))) return;
    this.service.deleteAttachment(a.id).subscribe({ next: c => this.changed.emit(c), error: e => this.error.set(e.message) });
  }

  close() { this.current.set(null); this.release(); }

  private release() {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set(null); this.safeUrl.set(null);
  }

  ngOnDestroy() { this.release(); }
}
