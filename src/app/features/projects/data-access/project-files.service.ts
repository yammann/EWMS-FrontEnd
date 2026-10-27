import { Injectable, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '@core/services/auth.service';
import { saveBlob } from '@core/utils/download';
import { DocumentVersion } from './projects.models';
import { ProjectsService } from './projects.service';

/** أكبر ملف يُعاين داخل الصفحة (يُحمَّل كاملاً في ذاكرة المتصفح) */
export const PREVIEW_LIMIT_BYTES = 100 * 1024 * 1024;
/** من هذا الحجم يُكتب التنزيل مباشرة على القرص (إن دعمه المتصفح) بدل حمله في الذاكرة */
export const STREAM_FROM_BYTES = 200 * 1024 * 1024;
/** أكبر ملف يُنزَّل عبر الذاكرة حين لا يدعم المتصفح الكتابة المباشرة على القرص */
export const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024;

interface SaveHandle { createWritable(): Promise<WritableStream<Uint8Array>>; }
type SavePicker = (options: { suggestedName: string }) => Promise<SaveHandle>;

/**
 * فتح ملفات الوثائق وتنزيلها. الملف يُطلب بترويسة الدخول (fetch) فلا يصلح رابطاً مباشراً، ولملف بعشرات الجيجابايتات
 * لا يجوز حمله كله في الذاكرة: في Chrome وEdge يُكتب مجراه على القرص مباشرة (showSaveFilePicker) مع شريط تقدّم،
 * وغيرهما يحمل حتى 1GB فقط ويطلب استعمال متصفح يدعم ذلك للأكبر.
 */
@Injectable({ providedIn: 'root' })
export class ProjectFiles {
  private auth = inject(AuthService);
  private projects = inject(ProjectsService);

  /** تنزيل جارٍ على القرص: الاسم والمقدار المكتوب والحجم الكلي */
  readonly downloading = signal<{ name: string; loaded: number; total: number } | null>(null);

  private picker(): SavePicker | null {
    return (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker?.bind(window) ?? null;
  }

  /** هل يستطيع المتصفح تنزيل هذا الحجم؟ (للرسالة قبل المحاولة) */
  canDownload(size: number): boolean {
    return size < MEMORY_LIMIT_BYTES || this.picker() != null;
  }

  private async request(version: DocumentVersion, download: boolean): Promise<Response> {
    const response = await fetch(`${environment.apiUrl}${this.projects.versionFilePath(version, download)}`, {
      headers: { Authorization: `Bearer ${this.auth.getToken() ?? ''}` }
    });
    if (!response.ok) {
      let message = response.status === 403 ? 'ليس لديك صلاحية لهذا الملف' : 'تعذّر جلب الملف';
      try { message = ((await response.json()) as { message?: string }).message ?? message; } catch { /* ليس JSON */ }
      throw new Error(message);
    }
    return response;
  }

  /** الملف كاملاً للمعاينة (حتى PREVIEW_LIMIT_BYTES) */
  async blob(version: DocumentVersion): Promise<Blob> {
    if (version.size > PREVIEW_LIMIT_BYTES) throw new Error('الملف أكبر من أن يُعاين داخل الصفحة — نزّله');
    const blob = await (await this.request(version, false)).blob();
    return new Blob([blob], { type: version.contentType });
  }

  /** تنزيل بنفس اسم الملف: عبر الذاكرة للصغير، ومجرى مباشر إلى القرص للكبير */
  async download(version: DocumentVersion): Promise<void> {
    const picker = this.picker();
    if (version.size >= STREAM_FROM_BYTES && picker) return this.streamToDisk(version, picker);
    if (version.size >= MEMORY_LIMIT_BYTES)
      throw new Error('الملف كبير: استعمل متصفح Chrome أو Edge لتنزيله مباشرة على القرص');

    const response = await this.request(version, true);
    saveBlob(await response.blob(), version.fileName);
  }

  private async streamToDisk(version: DocumentVersion, pick: SavePicker) {
    // نافذة اختيار المكان تحتاج نقرة المستخدم الحالية، فتُفتح قبل أي طلب
    let handle: SaveHandle;
    try { handle = await pick({ suggestedName: version.fileName }); }
    catch (e) { if ((e as DOMException).name === 'AbortError') return; throw e; }

    const response = await this.request(version, true);
    if (!response.body) throw new Error('المتصفح لا يدعم قراءة الملف تدريجياً');
    const writable = await handle.createWritable();
    this.downloading.set({ name: version.fileName, loaded: 0, total: version.size });

    let loaded = 0;
    const progress = new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        loaded += chunk.byteLength;
        this.downloading.set({ name: version.fileName, loaded, total: version.size });
        controller.enqueue(chunk);
      }
    });
    try {
      await response.body.pipeThrough(progress).pipeTo(writable);
    } finally {
      this.downloading.set(null);
    }
  }
}
