import { Component, inject } from '@angular/core';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { Icon } from './icon';

/** نافذة التأكيد الموحّدة — مرة واحدة في MainLayout (تفتحها ConfirmService.ask) */
@Component({
  selector: 'app-confirm-host', standalone: true, imports: [Modal, Icon],
  template: `
    @if (confirm.current(); as request) {
      <app-modal role="alertdialog" panelClass="confirm-dialog" (closed)="confirm.answer(false)">
        <div class="confirm-icon" aria-hidden="true">
          <app-icon name="warning" [weight]="2" />
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
