import { inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastService } from '@shared/ui/toast.service';

/** رسالة الخطأ من رد الـ API (ApiService يوحّدها في message) أو نص بديل */
export function errorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string; error?: { message?: string } } | null;
  return e?.error?.message || e?.message || fallback;
}

/**
 * تنفيذ إجراءات صفحات الإدارة (إنشاء/تعديل/حذف) بشكل موحّد: مؤشر الحفظ لكل زر، تنبيه النجاح/الخطأ، ثم إعادة التحميل.
 * يُنشأ كحقل في المكوّن (سياق الحقن): `private actions = new PageActions(() => this.load());`
 */
export class PageActions {
  private toast = inject(ToastService);

  /** مفتاح الإجراء الجاري ('create' | 'edit' | 'delete-5' ...) — لتعطيل الزر الصحيح وإظهار مؤشره */
  readonly saving = signal<string | null>(null);

  constructor(private reload: () => void) {}

  run(key: string, request: Observable<unknown>, successMessage: string, after?: () => void) {
    this.saving.set(key);
    request.subscribe({
      next: () => {
        this.saving.set(null);
        this.toast.success(successMessage);
        after?.();
        this.reload();
      },
      error: error => {
        this.saving.set(null);
        this.toast.error(errorMessage(error, 'تعذر تنفيذ العملية'));
      }
    });
  }

  loadFailed(error: unknown) {
    this.saving.set(null);
    this.toast.error(errorMessage(error, 'تعذر تحميل البيانات'));
  }
}
