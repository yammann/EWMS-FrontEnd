import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Modal } from '@shared/ui/modal';

/** نافذة صغيرة تطلب نصاً إجبارياً (سبب إعادة المهمة من المراجعة إلى التنفيذ) */
@Component({
  selector: 'app-task-note-dialog', standalone: true, imports: [FormsModule, Modal],
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" [busy]="busy()" (closed)="cancel.emit()">
      <div class="modal-body form-stack">
        <label class="form-field"><span class="form-label">{{ label() }}</span>
          <textarea rows="4" maxlength="500" autofocus [(ngModel)]="text" [placeholder]="placeholder()"></textarea>
          <small class="hint">{{ text.length }}/500 — يصل إلى الجهة المنفِّذة ويُسجَّل في المهمة</small></label>
      </div>
      <footer class="modal-actions">
        <button type="button" class="ghost" (click)="cancel.emit()" [disabled]="busy()">إلغاء</button>
        <button type="button" (click)="submit()" [disabled]="!text.trim() || busy()">{{ confirmLabel() }}</button>
      </footer>
    </app-modal>`
})
export class TaskNoteDialog {
  heading = input('إعادة المهمة للتنفيذ');
  subheading = input('');
  label = input('سبب الإعادة');
  placeholder = input('ما الذي ينقص أو يحتاج تعديلاً؟');
  confirmLabel = input('إعادة للتنفيذ');
  busy = input(false);

  /** النص بعد القص */
  confirm = output<string>();
  cancel = output<void>();
  text = '';
  protected sent = signal(false);

  submit() {
    const value = this.text.trim();
    if (value) this.confirm.emit(value);
  }
}
