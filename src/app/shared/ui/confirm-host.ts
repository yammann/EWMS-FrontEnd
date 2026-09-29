import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { Modal } from './modal';

/** نافذة التأكيد الموحّدة — مرة واحدة في MainLayout (تفتحها ConfirmService.ask) */
@Component({
  selector: 'app-confirm-host', standalone: true, imports: [Modal],
  template: `
    @if (confirm.current(); as request) {
      <app-modal role="alertdialog" panelClass="confirm-dialog" (closed)="confirm.answer(false)">
        <div class="confirm-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg>
        </div>
        <h3>{{ request.title }}</h3>
        <p>{{ request.message }}</p>
        <div class="confirm-actions">
          <button type="button" class="ghost" (click)="confirm.answer(false)">إلغاء</button>
          <button type="button" class="danger" (click)="confirm.answer(true)">{{ request.confirmLabel }}</button>
        </div>
      </app-modal>
    }`
})
export class ConfirmHost {
  protected confirm = inject(ConfirmService);
}
