import { Component, input, output } from '@angular/core';
import { Icon } from './icon';
import { ActionButton } from './action-button';

/**
 * رأس صفحات الإدارة (الفروع/الأقسام/المكاتب/المستخدمون/الأدوار): عنوان بنقطة، وصف، زر «تحديث» وزر «إنشاء» اختياري.
 * زر الإنشاء يظهر فقط حين يُمرَّر `createLabel` (مثلاً بحسب الصلاحية). الشكل من الفئات العامة.
 */
@Component({
  selector: 'app-admin-header', imports: [ActionButton, Icon],
  template: `
    <header class="page-header">
      <div class="page-title">
        <span class="eyebrow"><span class="eyebrow-dot"></span>{{ eyebrow() }}</span>
        <h1>{{ heading() }}</h1>
        <p>{{ subtitle() }}</p>
      </div>
      <div class="header-actions">
        <button type="button" class="refresh-btn" appAction="refresh" [busy]="loading()" busyLabel="جارٍ التحديث…" (click)="refresh.emit()">تحديث</button>
        @if (createLabel()) {
          <button type="button" class="new-btn" (click)="create.emit()">
            <app-icon name="plus" [size]="16" [weight]="2" />
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
