import { Component, input, output, signal } from '@angular/core';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';

/**
 * مراجعة مخطط غير معماري بانتظار المراجعة: اعتماد (ملاحظة اختيارية) أو رفض (ملاحظة مطلوبة).
 * الرفض يعيد المخطط لقسمه ليعدّله ويرسله من جديد. الحفظ عند الصفحة المستدعية (decided).
 */
@Component({
  selector: 'app-study-drawing-review-dialog',
  standalone: true,
  imports: [Modal, Alert],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal heading="مراجعة المخطط" [subheading]="subheading()" [busy]="busy()" (closed)="closed.emit()">
      <div class="modal-body form-stack">
        <app-alert [message]="error()" />
        <label class="form-field"><span class="form-label">ملاحظة المراجعة <small class="hint">(مطلوبة عند الرفض)</small></span>
          <textarea #box rows="4" maxlength="1000" [value]="note()" (input)="note.set(box.value)"></textarea></label>
      </div>
      <footer class="modal-actions">
        <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
        <button type="button" class="btn-danger" [disabled]="busy() || !note().trim()" (click)="decided.emit({ approve: false, note: note().trim() })">رفض</button>
        <button type="button" [disabled]="busy()" (click)="decided.emit({ approve: true, note: note().trim() })">اعتماد</button>
      </footer>
    </app-modal>
  `
})
export class StudyDrawingReviewDialog {
  subheading = input('');
  busy = input(false);
  error = input('');
  decided = output<{ approve: boolean; note: string }>();
  closed = output<void>();
  note = signal('');
}
