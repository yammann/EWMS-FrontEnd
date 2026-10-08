import { Component, input, output } from '@angular/core';

/** أزرار الصف في جداول الإدارة: تعديل + حذف (أيقونتان) بحسب الصلاحية، ومؤشر انشغال على الحذف. الشكل من .icon-btn العام. */
@Component({
  selector: 'app-row-actions', standalone: true,
  template: `
    <div class="row-actions">
      @if (canEdit()) {
        <button type="button" class="icon-btn edit" title="تعديل" (click)="edit.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
          </svg>
        </button>
      }
      @if (canDelete()) {
        <button type="button" class="icon-btn danger" title="حذف" (click)="remove.emit()" [disabled]="deleting()">
          @if (deleting()) {
            <span class="button-spinner dark"></span>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            </svg>
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
