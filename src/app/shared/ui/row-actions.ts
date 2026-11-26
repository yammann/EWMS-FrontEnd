import { Component, input, output } from '@angular/core';
import { ActionIcon } from './action-icon';

/**
 * أزرار الصف في جداول الإدارة: تعديل + حذف (أيقونتان) بحسب الصلاحية، ومؤشر انشغال على الحذف. الشكل من .icon-btn العام.
 * أزرار إضافية خاصة بالصفحة (مثل «السجل» أو «نسخ») تُمرَّر كمحتوى وتظهر قبلهما.
 */
@Component({
  selector: 'app-row-actions', imports: [ActionIcon],
  template: `
    <div class="row-actions">
      <ng-content />
      @if (canEdit()) {
        <button type="button" class="icon-btn edit" title="تعديل" aria-label="تعديل" (click)="edit.emit()">
          <app-action-icon kind="edit" [size]="16" />
        </button>
      }
      @if (canDelete()) {
        <button type="button" class="icon-btn danger" title="حذف" (click)="remove.emit()" [disabled]="deleting()"
                [attr.aria-label]="deleting() ? 'جارٍ الحذف…' : 'حذف'" [attr.aria-busy]="deleting()">
          <app-action-icon kind="delete" [size]="16" [busy]="deleting()" />
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
