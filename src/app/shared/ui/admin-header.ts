import { Component, input, output } from '@angular/core';

/**
 * رأس صفحات الإدارة (الفروع/الأقسام/المكاتب/المستخدمون/الأدوار): عنوان بنقطة، وصف، زر «تحديث» وزر «إنشاء» اختياري.
 * زر الإنشاء يظهر فقط حين يُمرَّر `createLabel` (مثلاً بحسب الصلاحية). الشكل من الفئات العامة.
 */
@Component({
  selector: 'app-admin-header', standalone: true,
  template: `
    <header class="page-header">
      <div class="page-title">
        <span class="eyebrow"><span class="eyebrow-dot"></span>{{ eyebrow() }}</span>
        <h1>{{ heading() }}</h1>
        <p>{{ subtitle() }}</p>
      </div>
      <div class="header-actions">
        <button type="button" class="refresh-btn" (click)="refresh.emit()" [disabled]="loading()">
          <svg class="icon" [class.spin]="loading()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"></path>
            <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"></path>
          </svg>
          <span>{{ loading() ? 'جاري التحديث...' : 'تحديث' }}</span>
        </button>
        @if (createLabel()) {
          <button type="button" class="new-btn" (click)="create.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"></path></svg>
            <span>{{ createLabel() }}</span>
          </button>
        }
      </div>
    </header>`,
  styles: [`:host { display: contents; }`]
})
export class AdminHeader {
  eyebrow = input('');
  heading = input.required<string>();
  subtitle = input('');
  loading = input(false);
  /** نص زر الإنشاء؛ فارغ = لا يظهر الزر */
  createLabel = input('');
  refresh = output<void>();
  create = output<void>();
}
