import { Component, inject, input, signal } from '@angular/core';
import { saveBlob } from '@core/utils/download';
import { fileSize } from '@core/utils/file-size';
import { errorMessage } from '@shared/ui/error-message';
import { FilePreview } from '@shared/ui/file-preview';
import { Icon, IconName } from '@shared/ui/icon';
import { ToastService } from '@shared/ui/toast.service';
import { MapEntryFile } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';

/** أيقونة حسب مجموعة الصيغة */
export function kindIcon(kind: string): IconName {
  return ({ images: 'photo', pdf: 'docText', office: 'docText', text: 'textLines', cad: 'ruler', maps: 'map', archives: 'zip', media: 'film' } as Record<string, IconName>)[kind] ?? 'paperclip';
}

/**
 * ملفات حقل في سجل طبقة: الصور وPDF تُعاين داخل نافذة (`app-file-preview`)، وباقي الصيغ تُنزَّل مباشرة.
 * الملف يُجلب كـ Blob (عبر معترض رمز الدخول)، ولا يُفتح شيء غير الصورة/PDF داخل الصفحة.
 */
@Component({
  selector: 'app-entry-files', imports: [FilePreview, Icon],
  template: `
    <ul class="files">
      @for (f of files(); track f.id) {
        <li>
          <button type="button" class="file" (click)="open(f)" [title]="(f.previewable ? 'معاينة ' : 'تنزيل ') + f.fileName" [disabled]="busyId() === f.id">
            <span class="ico" aria-hidden="true"><app-icon [name]="icon(f.kind)" /></span>
            <span class="meta"><span class="name">{{ f.fileName }}</span><small>{{ size(f.size) }}{{ f.previewable ? '' : ' · تنزيل' }}</small></span>
          </button>
        </li>
      } @empty { <li class="none">—</li> }
    </ul>

    <app-file-preview [file]="current()" [load]="blob" (closed)="current.set(null)" />`,
  styles: [`
    .files { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .file { display: inline-flex; align-items: center; gap: 8px; max-width: 280px; min-height: 36px; padding: 4px 10px; text-align: start;
      border-radius: var(--radius-md); background: var(--fill); color: var(--ink-800); box-shadow: none; font-weight: 600; font-size: 12.5px; }
    .file:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .ico { display: grid; flex: none; color: var(--brand-700); }
    .meta { display: grid; min-width: 0; }
    .name { line-height: 1.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta small { color: var(--ink-500); font-weight: 400; font-size: 11px; }
    .none { color: var(--ink-500); }
  `]
})
export class EntryFiles {
  private service = inject(MapLayersService);
  private toast = inject(ToastService);

  files = input<MapEntryFile[]>([]);

  size = fileSize;
  icon = kindIcon;
  current = signal<MapEntryFile | null>(null);
  blob = (id: number) => this.service.fileBlob(id);
  /** ملف يُنزَّل الآن (بلا معاينة) */
  busyId = signal<number | null>(null);

  open(f: MapEntryFile) {
    if (f.previewable) { this.current.set(f); return; }
    this.busyId.set(f.id);
    this.service.fileBlob(f.id).subscribe({
      next: blob => { this.busyId.set(null); saveBlob(blob, f.fileName); },
      error: e => { this.busyId.set(null); this.toast.error(errorMessage(e, 'تعذر تنزيل الملف')); }
    });
  }
}
