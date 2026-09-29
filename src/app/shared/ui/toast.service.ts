import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/**
 * تنبيهات قصيرة موحّدة لكل الصفحات (نجاح/خطأ/معلومة) — تُعرض مرة واحدة عبر &lt;app-toasts&gt; في الإطار العام.
 * (منفصلة عن إشعارات SignalR المنبثقة في notification-toasts).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'success') {
    const id = ++this.seq;
    this.toasts.update(list => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), type === 'error' ? 6000 : 3500);
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error'); }
  info(message: string) { this.show(message, 'info'); }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  /** نسخ نص للحافظة مع تنبيه بالنتيجة */
  async copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.info(`تم نسخ ${label}`);
    } catch {
      this.error('تعذر النسخ — انسخ يدوياً');
    }
  }
}
