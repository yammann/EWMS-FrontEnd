import { saveBlob } from './download';

/** أكبر حجم يُحمَّل في الذاكرة حين لا يدعم المتصفح الكتابة المباشرة على القرص */
export const MAX_IN_MEMORY_BYTES = 200 * 1024 * 1024;

/** نافذة الحفظ في Chrome وEdge (غير موجودة في تعريفات lib.dom) */
interface SaveFileHandle { createWritable(): Promise<WritableStream<Uint8Array>>; }
type SavePicker = (options: { suggestedName: string }) => Promise<SaveFileHandle>;

export interface StreamDownloadOptions {
  fileName: string;
  /** رمز الدخول (fetch لا يمر بمعترض الطلبات) */
  token: string | null;
  signal?: AbortSignal;
  /** البايتات المستلمة حتى الآن، والحجم الكلي إن عرفه الخادم */
  onProgress?: (received: number, total: number | null) => void;
}

export type StreamDownloadResult = 'saved' | 'cancelled';

/** يدعم هذا المتصفح الكتابة المباشرة على القرص؟ */
export function canStreamToDisk(): boolean {
  return typeof (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker === 'function';
}

/**
 * ينزّل ملفاً كبيراً دون تحميله في الذاكرة: `fetch` مع ترويسة الدخول ثم يُكتب مباشرة على القرص
 * (`showSaveFilePicker` في Chrome وEdge). في المتصفحات الأخرى يرجع إلى Blob للملفات الصغيرة فقط
 * ويرفض الكبيرة برسالة تطلب Chrome أو Edge — لأن الملف سيملأ الذاكرة.
 * نافذة الحفظ تُفتح قبل الطلب (تحتاج نقرة المستخدم)، وإلغاؤها يعيد 'cancelled' بلا خطأ.
 * أي خطأ يُرمى كـ Error برسالة عربية جاهزة للعرض.
 */
export async function streamDownload(url: string, options: StreamDownloadOptions): Promise<StreamDownloadResult> {
  const { fileName, token, signal, onProgress } = options;
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;

  let writable: WritableStream<Uint8Array> | null = null;
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: fileName });
      writable = await handle.createWritable();
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      writable = null; // رفض المتصفح الكتابة المباشرة: نرجع إلى الطريقة العادية
    }
  }

  try {
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
    if (!response.ok) throw new Error(await failureMessage(response));
    const total = Number(response.headers.get('Content-Length')) || null;

    if (writable && response.body) {
      let received = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          onProgress?.(received, total);
          controller.enqueue(chunk);
        }
      });
      await response.body.pipeThrough(counter, { signal }).pipeTo(writable, { signal }); // يُغلق الملف عند الانتهاء
      writable = null;
      return 'saved';
    }

    if (total && total > MAX_IN_MEMORY_BYTES) {
      throw new Error('الملف كبير ولا يدعم هذا المتصفح حفظه مباشرة على القرص — استعمل Chrome أو Edge');
    }
    const blob = await response.blob();
    onProgress?.(blob.size, blob.size);
    saveBlob(blob, fileName);
    return 'saved';
  } catch (e) {
    if (writable) await writable.abort().catch(() => undefined);
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    throw e instanceof Error ? e : new Error('تعذر تنزيل الملف');
  }
}

/** رسالة الخادم العربية من رد الخطأ، أو نص بحسب رمز الحالة */
async function failureMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string; title?: string };
    if (body.message || body.title) return (body.message || body.title)!;
  } catch { /* الرد ليس JSON */ }
  if (response.status === 401) return 'انتهت جلسة الدخول — سجّل الدخول من جديد';
  if (response.status === 403) return 'ليس لديك صلاحية لتنزيل هذا الملف';
  if (response.status === 404) return 'الملف غير موجود';
  return 'تعذر تنزيل الملف';
}
