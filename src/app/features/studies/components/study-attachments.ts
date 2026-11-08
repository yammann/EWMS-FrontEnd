import { HttpEventType } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { fileSize } from '@core/utils/file-size';
import { canStreamToDisk } from '@core/utils/stream-download';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { errorMessage } from '@shared/ui/error-message';
import { Icon, IconName } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { StudyAttachmentsService } from '../data-access/study-attachments.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyAttachment, StudyLookup, StudyOwnerType } from '../data-access/studies.models';

/** الحد الأقصى لعدد المرفقات في السجل الواحد (يفرضه الخادم أيضاً) */
const MAX_FILES = 100;
/** تلميح لنافذة اختيار الملفات فقط؛ الخادم يكشف النوع من محتوى الملف */
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.txt,.csv,.zip,.rar,.7z';

/** رسالة الخادم حين لا يكون مجلد المرفقات مضبوطاً (FileStorage:Root) */
const STORAGE_NOT_READY = /FileStorage/i;

type UploadState = 'wait' | 'up' | 'error';
interface UploadItem { key: number; file: File; typeId: number; typeName: string; state: UploadState; progress: number; error: string; }

/** أيقونة الملف من نوعه */
function iconOf(a: StudyAttachment): IconName {
  const t = a.contentType;
  if (t.startsWith('image/')) return 'photo';
  if (t === 'application/pdf' || t.includes('word') || t.startsWith('text/')) return 'docText';
  if (t.includes('sheet') || t.includes('excel')) return 'table';
  if (t.includes('presentation') || t.includes('powerpoint')) return 'presentation';
  if (t.includes('zip') || t.includes('rar') || t.includes('7z') || t.includes('compressed')) return 'zip';
  if (/dwg|dxf|acad|cad/i.test(t) || /\.(dwg|dxf)$/i.test(a.fileName)) return 'ruler';
  return 'paperclip';
}

/**
 * مرفقات سجل دراسة (طلب، تكليف، رد، أمر بدء…): جدول بالمرفقات، ورفع متعدد من نافذة الاختيار أو بالسحب والإفلات.
 * - ملف واحد لكل طلب رفع، متتابعة، مع شريط تقدّم لكل ملف وإمكانية الإلغاء. لا سقف لحجم الملف (يصل إلى 1GB).
 * - المعاينة للصور وPDF فقط داخل نافذة؛ باقي الصيغ تُنزَّل. التنزيل تدفقاً إلى القرص (Chrome وEdge) فلا يملأ الذاكرة.
 * - الرفع والحذف حسب `canWrite` وعلم `canDelete` من الخادم؛ والخادم يفحص الصلاحية من جديد في كل طلب.
 */
@Component({
  selector: 'app-study-attachments',
  standalone: true,
  imports: [DatePipe, UtcPipe, Alert, Icon, Modal, SelectValue],
  template: `
    <section class="panel">
      <div class="panel-heading"><div>
        <h2>المرفقات @if (items().length) { <small class="count">({{ items().length }})</small> }</h2>
        <p>صور وPDF ومستندات Office ومخططات DWG/DXF ونصوص وملفات مضغوطة. لا سقف لحجم الملف، والحد الأقصى {{ max }} ملفاً للسجل.</p>
      </div></div>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (canWrite() && storageDown()) {
        <p class="alert alert-warning" role="alert">رفع الملفات غير متاح الآن: مجلد المرفقات لم يُضبط على الخادم (FileStorage:Root). أبلغ مدير النظام، ثم أعد تحميل الصفحة.
          <button type="button" class="btn btn-ghost btn-sm" (click)="storageDown.set(false); queue.set([])">إخفاء</button></p>
      }
      @if (canWrite() && !storageDown()) {
        <div class="uploader" [class.over]="dragOver()" (dragover)="over($event, true)" (dragleave)="over($event, false)" (drop)="dropped($event)">
          <label class="type-pick">
            <span class="form-label">نوع المرفق</span>
            <select #t [appSelectValue]="typeId() ?? ''" (change)="typeId.set(+t.value || null)" [disabled]="full()">
              <option value="">— اختر —</option>
              @for (x of types(); track x.id) { <option [value]="x.id">{{ x.name }}</option> }
            </select>
          </label>
          <div class="drop">
            <app-icon name="paperclip" [size]="20" />
            <span>{{ full() ? 'اكتمل عدد المرفقات' : 'اسحب الملفات إلى هنا أو' }}</span>
            <button type="button" class="btn btn-sm" (click)="file.click()" [disabled]="full()">اختيار ملفات</button>
            <input #file type="file" multiple hidden [accept]="accept" (change)="picked(file)" />
          </div>
        </div>
        @if (!types().length && typesLoaded()) { <p class="muted note">لا توجد أنواع مرفقات فعّالة — أضفها من «إعدادات الدراسات».</p> }
        @if (pickError()) { <p class="alert alert-error" role="alert">{{ pickError() }}</p> }

        @if (queue().length) {
          <ul class="queue">
            @for (q of queue(); track q.key) {
              <li [class.failed]="q.state === 'error'">
                <div class="q-info">
                  <strong class="q-name">{{ q.file.name }}</strong>
                  <small>{{ q.typeName }} · {{ size(q.file.size) }}</small>
                  @if (q.state === 'error') { <small class="q-error" role="alert">{{ q.error }}</small> }
                </div>
                @switch (q.state) {
                  @case ('up') {
                    <div class="bar" role="progressbar" [attr.aria-valuenow]="q.progress" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="q.progress"></span></div>
                    <small class="pct">{{ q.progress < 100 ? q.progress + '%' : 'جارٍ الفحص…' }}</small>
                  }
                  @case ('wait') { <small class="pct">بالانتظار</small> }
                }
                <button type="button" class="btn btn-ghost btn-sm" (click)="cancelUpload(q)">{{ q.state === 'error' ? 'إخفاء' : 'إلغاء' }}</button>
              </li>
            }
          </ul>
        }
      }

      @if (loading() && !items().length) {
        <p class="muted">جارٍ التحميل…</p>
      } @else if (!items().length) {
        <p class="muted">لا مرفقات.</p>
      } @else {
        <div class="table-wrap"><table>
          <thead><tr><th>الملف</th><th>النوع</th><th>الحجم</th><th>رُفع بواسطة</th><th class="actions-col">إجراءات</th></tr></thead>
          <tbody>
            @for (a of items(); track a.id) {
              <tr>
                <td><span class="file"><app-icon [name]="icon(a)" [size]="18" /><span class="file-name">{{ a.fileName }}</span></span></td>
                <td>{{ a.attachmentTypeName }}</td>
                <td class="mono">{{ size(a.size) }}</td>
                <td>{{ a.uploadedByName }}<small class="when">{{ a.uploadedAt | utc | date:'yyyy/MM/dd' }}</small></td>
                <td class="actions">
                  @if (downloading()[a.id] !== undefined) {
                    <small class="pct">{{ downloading()[a.id] === null ? '…' : downloading()[a.id] + '%' }}</small>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="cancelDownload(a.id)">إلغاء</button>
                  } @else {
                    @if (a.previewable) { <button type="button" class="btn btn-ghost btn-sm" (click)="preview(a)">معاينة</button> }
                    <button type="button" class="btn btn-ghost btn-sm" (click)="download(a)">تنزيل</button>
                    @if (a.canDelete && canWrite()) {
                      <button type="button" class="btn btn-ghost btn-sm del" (click)="remove(a)" [disabled]="removingId() === a.id" [attr.aria-label]="'حذف ' + a.fileName">
                        <app-icon name="trash" [size]="15" />
                      </button>
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table></div>
        @if (!streamable) { <p class="muted note">لتنزيل الملفات الكبيرة (مئات الميجابايت فأكثر) استعمل Chrome أو Edge.</p> }
      }
    </section>

    @if (viewing(); as v) {
      <app-modal [heading]="v.fileName" size="lg" (closed)="closePreview()">
        <div class="modal-body viewer">
          @if (previewError()) { <p class="alert alert-error" role="alert">{{ previewError() }}</p> }
          @else if (!safeUrl()) { <p class="muted" role="status">جارٍ التحميل…</p> }
          @else if (v.contentType === 'application/pdf') { <iframe [src]="safeUrl()" title="معاينة الملف"></iframe> }
          @else { <img [src]="safeUrl()" [alt]="v.fileName" /> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closePreview()">إغلاق</button>
          <button type="button" (click)="download(v)">تنزيل</button>
        </footer>
      </app-modal>
    }
  `,
  styles: [`
    .count { font-weight: 400; color: var(--ink-500); }
    .note { margin: 10px 0 0; font-size: 13px; }
    .uploader { display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); gap: 14px; align-items: end; padding: 14px; border-radius: 12px;
      background: var(--fill); border: 1.5px dashed transparent; margin-bottom: 14px; }
    .uploader.over { border-color: var(--brand-500); background: var(--brand-50); }
    .type-pick { display: grid; gap: 6px; }
    .drop { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-height: 44px; color: var(--ink-600); font-size: 13px; }
    @media (max-width: 640px) { .uploader { grid-template-columns: minmax(0, 1fr); } }
    .queue { list-style: none; margin: 0 0 14px; padding: 0; display: grid; gap: 8px; }
    .queue li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(80px, 180px) auto auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--fill); }
    .queue li.failed { box-shadow: inset 0 0 0 1.5px var(--danger-500); }
    .q-info { display: grid; min-width: 0; }
    .q-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .q-info small, .pct { color: var(--ink-500); font-size: 12px; }
    .q-error { color: var(--danger-700) !important; }
    .bar { height: 6px; border-radius: 3px; background: var(--fill-strong); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--brand-600); transition: width .2s; }
    .file { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; color: var(--brand-700); }
    .file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-900); font-weight: 600; }
    .actions-col { width: 1%; }
    .actions { white-space: nowrap; text-align: end; }
    .del { color: var(--danger-700); }
    .when { display: block; color: var(--ink-500); font-size: 12px; }
    .viewer { display: grid; place-items: center; min-height: 320px; }
    .viewer iframe { width: 100%; height: 70vh; border: 0; border-radius: var(--radius-md); background: var(--surface); }
    .viewer img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); }
    @media (max-width: 640px) { .queue li { grid-template-columns: minmax(0, 1fr) auto; } .queue .bar { grid-column: 1 / -1; order: 3; } }
  `]
})
export class StudyAttachments implements OnDestroy {
  private service = inject(StudyAttachmentsService);
  private lookups = inject(StudyLookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private latest = latestRequest();

  ownerType = input.required<StudyOwnerType>();
  ownerId = input.required<number>();
  /** رفع وحذف: صلاحية تعديل صاحب المرفق وأن لا يكون ملغى (الخادم يتحقق من جديد) */
  canWrite = input(false);
  /** أُضيف مرفق أو حُذف — ليُحدَّث سجل الدراسة */
  changed = output<void>();

  readonly max = MAX_FILES;
  readonly accept = ACCEPT;
  readonly streamable = canStreamToDisk();
  size = fileSize;
  icon = iconOf;

  items = signal<StudyAttachment[]>([]);
  loading = signal(false);
  error = signal('');

  types = signal<StudyLookup[]>([]);
  typesLoaded = signal(false);
  typeId = signal<number | null>(null);
  pickError = signal('');
  /** الخادم أعلن أن مجلد المرفقات غير مضبوط: يتوقف الرفع بهذه الصفحة حتى إعادة تحميلها */
  storageDown = signal(false);
  dragOver = signal(false);
  queue = signal<UploadItem[]>([]);
  full = computed(() => this.items().length + this.queue().filter(q => q.state !== 'error').length >= MAX_FILES);

  /** تنزيلات جارية: معرّف المرفق → نسبة التقدّم (null = حجم غير معروف) */
  downloading = signal<Record<number, number | null>>({});
  removingId = signal<number | null>(null);
  viewing = signal<StudyAttachment | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  previewError = signal('');

  private seq = 0;
  private running = false;
  private cancels = new Map<number, () => void>();
  private downloads = new Map<number, AbortController>();
  private previewUrl: string | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.ownerType(); this.ownerId();
      untracked(() => this.load());
    });
    effect(() => {
      if (this.canWrite() && !this.typesLoaded()) untracked(() => this.loadTypes());
    });
  }

  load() {
    this.latest(this.service.list(this.ownerType(), this.ownerId()), this.loading, this.error, list => this.items.set(list));
  }

  private loadTypes() {
    this.typesLoaded.set(true);
    this.lookups.lookup('attachmentTypes', true).subscribe({
      next: list => {
        this.types.set(list);
        if (list.length === 1) this.typeId.set(list[0].id);
      },
      error: e => this.pickError.set(errorMessage(e, 'تعذر تحميل أنواع المرفقات'))
    });
  }

  // ─────────── الرفع ───────────
  over(event: DragEvent, on: boolean) { event.preventDefault(); this.dragOver.set(on && !this.full()); }

  dropped(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files.length) this.enqueue(Array.from(event.dataTransfer.files));
  }

  picked(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = ''; // ليُقبل اختيار الملف نفسه مرة أخرى
    if (files.length) this.enqueue(files);
  }

  private enqueue(files: File[]) {
    this.pickError.set('');
    const type = this.types().find(t => t.id === this.typeId());
    if (!type) { this.pickError.set('اختر نوع المرفق أولاً'); return; }
    if (!this.canWrite()) return;

    const room = MAX_FILES - this.items().length - this.queue().filter(q => q.state !== 'error').length;
    const accepted = files.slice(0, Math.max(0, room));
    if (accepted.length < files.length) this.pickError.set(`لا يتسع السجل لكل الملفات (الحد ${MAX_FILES}) — أُضيف ${accepted.length} فقط`);
    const empty = accepted.filter(f => f.size === 0);
    if (empty.length) this.pickError.set(`ملف فارغ مُهمَل: ${empty.map(f => f.name).join('، ')}`);

    const added: UploadItem[] = accepted.filter(f => f.size > 0).map(file => (
      { key: ++this.seq, file, typeId: type.id, typeName: type.name, state: 'wait', progress: 0, error: '' }));
    if (!added.length) return;
    this.queue.update(q => [...q, ...added]);
    void this.drain();
  }

  private patch(key: number, change: Partial<UploadItem>) {
    this.queue.update(q => q.map(i => i.key === key ? { ...i, ...change } : i));
  }

  /** يرفع بالتتابع ملفاً واحداً لكل طلب */
  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (let next = this.nextWaiting(); next && !this.destroyed; next = this.nextWaiting()) await this.send(next);
    } finally { this.running = false; }
  }

  private nextWaiting() { return this.queue().find(q => q.state === 'wait'); }

  private send(item: UploadItem): Promise<void> {
    return new Promise<void>(resolve => {
      const done = () => { this.cancels.delete(item.key); resolve(); };
      this.patch(item.key, { state: 'up', progress: 0 });
      const sub = this.service.upload(this.ownerType(), this.ownerId(), item.typeId, item.file).subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.patch(item.key, { progress: event.total ? Math.min(100, Math.round(100 * event.loaded / event.total)) : 0 });
          } else if (event.type === HttpEventType.Response && event.body) {
            this.items.update(list => [event.body!, ...list]);
            this.queue.update(q => q.filter(i => i.key !== item.key));
            this.changed.emit();
          }
        },
        error: e => {
          const message = errorMessage(e, 'تعذر رفع الملف');
          this.patch(item.key, { state: 'error', error: message });
          // إعداد خادم ناقص (مجلد المرفقات) لا يُحل بإعادة الملفات: نوقف البقية بدل أن يفشل كلٌّ منها على حدة
          if (STORAGE_NOT_READY.test(message)) {
            this.storageDown.set(true);
            this.queue.update(q => q.map(i => i.state === 'wait' ? { ...i, state: 'error', error: message } : i));
          }
          done();
        },
        complete: done
      });
      this.cancels.set(item.key, () => { sub.unsubscribe(); done(); });
    });
  }

  cancelUpload(item: UploadItem) {
    this.cancels.get(item.key)?.();
    this.queue.update(q => q.filter(i => i.key !== item.key));
  }

  // ─────────── المعاينة والتنزيل ───────────
  preview(a: StudyAttachment) {
    this.releasePreview();
    this.previewError.set('');
    this.viewing.set(a);
    this.service.previewBlob(a.id).subscribe({
      next: blob => {
        if (this.viewing()?.id !== a.id) return;
        this.previewUrl = URL.createObjectURL(new Blob([blob], { type: a.contentType }));
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl));
      },
      error: e => this.previewError.set(errorMessage(e, 'تعذر فتح الملف'))
    });
  }

  closePreview() { this.viewing.set(null); this.releasePreview(); }

  private releasePreview() {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null; this.safeUrl.set(null);
  }

  async download(a: StudyAttachment) {
    if (this.downloads.has(a.id)) return;
    const abort = new AbortController();
    this.downloads.set(a.id, abort);
    this.downloading.update(d => ({ ...d, [a.id]: null }));
    try {
      const result = await this.service.download(a, (received, total) => {
        if (total) this.downloading.update(d => ({ ...d, [a.id]: Math.min(100, Math.round(100 * received / total)) }));
      }, abort.signal);
      if (result === 'saved') this.toast.success(`حُفظ «${a.fileName}»`);
    } catch (e) {
      this.toast.error(errorMessage(e, 'تعذر تنزيل الملف'));
    } finally {
      this.downloads.delete(a.id);
      this.downloading.update(d => { const { [a.id]: _gone, ...rest } = d; return rest; });
    }
  }

  cancelDownload(id: number) { this.downloads.get(id)?.abort(); }

  // ─────────── الحذف ───────────
  async remove(a: StudyAttachment) {
    if (!await this.confirm.ask(`حذف المرفق «${a.fileName}»؟ لا يمكن التراجع.`, 'حذف')) return;
    this.removingId.set(a.id);
    this.service.remove(a.id).subscribe({
      next: () => {
        this.removingId.set(null);
        this.items.update(list => list.filter(x => x.id !== a.id));
        this.toast.success('حُذف المرفق');
        this.changed.emit();
      },
      error: e => { this.removingId.set(null); this.toast.error(errorMessage(e, 'تعذر حذف المرفق')); }
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.releasePreview();
    this.downloads.forEach(c => c.abort());
    this.cancels.forEach(cancel => cancel());
  }
}
