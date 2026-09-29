import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  title: string;
  resolve: (confirmed: boolean) => void;
}

/**
 * نافذة تأكيد موحّدة (للحذف والإجراءات الخطرة) — تُعرض عبر &lt;app-confirm-host&gt; في الإطار العام.
 * الاستخدام: if (await this.confirm.ask('حذف الفرع؟', 'حذف')) { ... }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(message: string, confirmLabel = 'تأكيد', title = 'تأكيد الإجراء'): Promise<boolean> {
    this.current()?.resolve(false);   // طلب جديد يلغي السابق
    return new Promise(resolve => this.current.set({ message, confirmLabel, title, resolve }));
  }

  answer(confirmed: boolean) {
    const request = this.current();
    this.current.set(null);
    request?.resolve(confirmed);
  }
}
