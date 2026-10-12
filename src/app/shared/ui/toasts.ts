import { Component, inject } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from '@shared/ui/toast.service';

/** حاوية التنبيهات — مرة واحدة في MainLayout */
@Component({
  selector: 'app-toasts', standalone: true, imports: [Icon],
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast toast-{{ toast.type }}" [attr.role]="toast.type === 'error' ? 'alert' : 'status'" (click)="service.dismiss(toast.id)">
          <div class="toast-icon" aria-hidden="true">
            @switch (toast.type) {
              @case ('success') { <app-icon name="checkmark" [weight]="2.2" /> }
              @case ('error') { <app-icon name="alert" [weight]="2" /> }
              @default { <app-icon name="info" [weight]="2" /> }
            }
          </div>
          <span class="toast-message">{{ toast.message }}</span>
          <button type="button" class="toast-close" aria-label="إغلاق" (click)="service.dismiss(toast.id); $event.stopPropagation()">
            <app-icon name="xmark" [weight]="2.2" />
          </button>
        </div>
      }
    </div>`
})
export class Toasts {
  protected service = inject(ToastService);
  protected toasts = this.service.toasts;
}
