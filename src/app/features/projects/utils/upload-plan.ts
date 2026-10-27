/**
 * منطق الرفع المجزّأ الصرف (بلا HTTP ولا واجهة): تخطيط الأجزاء، قرار إعادة المحاولة، السرعة والوقت المتبقي.
 * مطابق لقواعد الخادم (ProjectUploadRules): جزء يبدأ عند ما استُلم تماماً، وطوله ≤ حجم الجزء ولا يتجاوز الملف.
 */
export interface ChunkPlan { offset: number; length: number; }

/** الجزء التالي بعد ما استُلم، أو null إن اكتمل الملف */
export function nextChunk(received: number, size: number, chunkSize: number): ChunkPlan | null {
  if (received < 0 || size <= 0 || chunkSize <= 0 || received >= size) return null;
  return { offset: received, length: Math.min(chunkSize, size - received) };
}

/** عدد الأجزاء المتبقية */
export function chunksLeft(received: number, size: number, chunkSize: number): number {
  return received >= size || chunkSize <= 0 ? 0 : Math.ceil((size - received) / chunkSize);
}

/** انقطاع الشبكة (0) أو مهلة (408) أو خطأ خادم عابر (5xx): تُعاد المحاولة بعد مزامنة ما استُلم */
export function isRetryable(status: number | undefined): boolean {
  return status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500);
}

/** انتظار متصاعد بين محاولات الجزء الواحد: 1، 2، 4، 8، 15 ثانية (يتوقف عند 15) */
export function backoffMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

export const MAX_CHUNK_ATTEMPTS = 6;

/** الجلسة المحفوظة في الخادم تخص هذا الملف (الاسم والحجم) — شرط استئناف رفع انقطع بعد تحديث الصفحة */
export function sameFile(file: { name: string; size: number }, session: { fileName: string; size: number }): boolean {
  return file.size === session.size && file.name.trim().toLowerCase() === session.fileName.trim().toLowerCase();
}

/** عنوان مقترح للوثيقة من اسم الملف: بلا الامتداد وبلا شرطات سفلية */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.replace(/[_]+/g, ' ').trim().slice(0, 200);
}

/** عينات (زمن بالمللي ثانية، بايتات مرسلة) لحساب السرعة على نافذة قصيرة */
export class SpeedMeter {
  private samples: { t: number; bytes: number }[] = [];
  constructor(private windowMs = 8_000) {}

  add(t: number, bytes: number) {
    this.samples.push({ t, bytes });
    const from = t - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].t < from) this.samples.shift();
  }

  /** بايت/ثانية (0 قبل وجود عينتين) */
  bytesPerSecond(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0], last = this.samples[this.samples.length - 1];
    const seconds = (last.t - first.t) / 1000;
    return seconds > 0 ? Math.max(0, (last.bytes - first.bytes) / seconds) : 0;
  }

  reset() { this.samples = []; }
}

/** الوقت المتبقي بالثواني (null إن لم تُعرف السرعة بعد) */
export function etaSeconds(remainingBytes: number, bytesPerSecond: number): number | null {
  return bytesPerSecond > 0 && remainingBytes >= 0 ? Math.ceil(remainingBytes / bytesPerSecond) : null;
}

/** «3 د 20 ث» */
export function formatEta(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds} ث`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  if (m < 60) return s ? `${m} د ${s} ث` : `${m} د`;
  const h = Math.floor(m / 60), rest = m % 60;
  return rest ? `${h} س ${rest} د` : `${h} س`;
}

/** حجم مقروء يتسع للجيجابايتات (core/utils/file-size لا يتجاوز MB) */
export function bigFileSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 1 : 2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
