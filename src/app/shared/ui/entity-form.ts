import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Alert } from './alert';

/**
 * نموذج الاسم + الوصف لنوافذ إنشاء/تعديل كيانات الإدارة (فرع/قسم/مكتب) — بدل نسختين متطابقتين تقريباً في كل صفحة.
 * حقول إضافية: محتوى عادي = بعد الوصف، و`ngProjectAs="[before]"` = قبله (يجب أن يلفّها `[formGroup]` بنفس النموذج).
 * أيقونة حقل الاسم: عنصر svg بسمة `nameIcon` (تظهر في الإنشاء فقط، كما كان).
 */
@Component({
  selector: 'app-entity-form', standalone: true, imports: [ReactiveFormsModule, Alert],
  template: `
    <form [formGroup]="form()" (ngSubmit)="submitted.emit()" class="form-stack">
      <app-alert [message]="error()" />
      <div class="form-field">
        <label class="form-label" [attr.for]="mode() + '-name'">{{ nameLabel() }}</label>
        @if (mode() === 'create' && iconed()) {
          <div class="input-wrapper">
            <ng-content select="[nameIcon]" />
            <input [id]="mode() + '-name'" type="text" formControlName="name" [placeholder]="namePlaceholder()" autocomplete="off" />
          </div>
        } @else if (mode() === 'create') {
          <input [id]="mode() + '-name'" type="text" formControlName="name" [attr.maxlength]="nameMaxLength() || null" [placeholder]="namePlaceholder()" autocomplete="off" />
        } @else {
          <input [id]="mode() + '-name'" type="text" formControlName="name" [attr.maxlength]="nameMaxLength() || null" />
        }
        @if (nameControl.touched && nameControl.invalid) {
          <small class="form-error">أدخل اسماً لا يقل عن حرفين.</small>
        }
      </div>

      <ng-content select="[before]" />

      <div class="form-field">
        <label class="form-label" [attr.for]="mode() + '-desc'">الوصف</label>
        <textarea [id]="mode() + '-desc'" formControlName="description" [rows]="mode() === 'create' ? 3 : 4"
                  [attr.maxlength]="descMaxLength() || null" [attr.placeholder]="mode() === 'create' ? descPlaceholder() : null"></textarea>
      </div>

      <ng-content />

      <div class="modal-actions">
        <button type="button" class="ghost" (click)="dismissed.emit()">إلغاء</button>
        <button type="submit" [disabled]="form().invalid || saving() === mode()">
          @if (saving() === mode()) {
            <span class="button-spinner"></span>
            <span>{{ mode() === 'create' ? 'جاري الإنشاء...' : 'جاري الحفظ...' }}</span>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              @if (mode() === 'create') { <path d="M12 5v14M5 12h14"></path> } @else { <path d="M20 6 9 17l-5-5"></path> }
            </svg>
            <span>{{ mode() === 'create' ? createLabel() : 'حفظ التعديل' }}</span>
          }
        </button>
      </div>
    </form>`
})
export class EntityForm {
  mode = input.required<'create' | 'edit'>();
  form = input.required<FormGroup>();
  nameLabel = input.required<string>();
  namePlaceholder = input('');
  descPlaceholder = input('');
  /** نص زر الإنشاء، مثل «إنشاء الفرع» */
  createLabel = input.required<string>();
  /** مفتاح الإجراء الجاري من PageActions ('create' | 'edit' | ...) */
  saving = input<string | null>(null);
  /** خطأ الحفظ من الخادم — يظهر داخل النافذة فوق الحقول */
  error = input('');
  descMaxLength = input(0);
  nameMaxLength = input(0);
  /** أيقونة داخل حقل الاسم في الإنشاء (الفروع والأقسام فقط) */
  iconed = input(true);
  submitted = output<void>();
  dismissed = output<void>();

  protected get nameControl() { return this.form().controls['name']; }
}
