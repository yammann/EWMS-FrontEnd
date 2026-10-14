import { Component, input, output } from '@angular/core';
import { Icon } from './icon';

/**
 * أزرار الصف في جداول الإدارة: تعديل + حذف (أيقونتان) بحسب الصلاحية، ومؤشر انشغال على الحذف. الشكل من .icon-btn العام.
 * أزرار إضافية خاصة بالصفحة (مثل «السجل» أو «نسخ») تُمرَّر كمحتوى وتظهر قبلهما.
 */
@Component({
  selector: 'app-row-actions', standalone: true, imports: [Icon],
  template: `
    <div class="row-actions">
      <ng-content />
      @if (canEdit()) {
        <button type="button" class="icon-btn edit" title="تعديل" (click)="edit.emit()">
          <app-icon name="pencil" [weight]="2" />
        </button>
      }
      @if (canDelete()) {
        <button type="button" class="icon-btn danger" title="حذف" (click)="remove.emit()" [disabled]="deleting()">
          @if (deleting()) {
            <span class="button-spinner dark"></span>
          } @else {
            <app-icon name="trash" [weight]="2" />
          }
        </button>
      }
    </div>`,
  styles: [`:host { display: contents; }`]
})
export class RowActions {
  canEdit = input(false);
  canDelete = input(false);
  /** جارٍ حذف هذا الصف */
  deleting = input(false);
  edit = output<void>();
  remove = output<void>();
}
