import { Component, inject } from '@angular/core';
import { ToastService } from '@shared/ui/toast.service';

/** حاوية التنبيهات — مرة واحدة في MainLayout */
@Component({
  selector: 'app-toasts', standalone: true,
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast toast-{{ toast.type }}" [attr.role]="toast.type === 'error' ? 'alert' : 'status'" (click)="service.dismiss(toast.id)">
          <div class="toast-icon" aria-hidden="true">
            @switch (toast.type) {
              @case ('success') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> }
              @case ('error') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> }
              @default { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> }
            }
          </div>
          <span class="toast-message">{{ toast.message }}</span>
          <button type="button" class="toast-close" aria-label="إغلاق" (click)="service.dismiss(toast.id); $event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      }
    </div>`
})
export class Toasts {
  protected service = inject(ToastService);
  protected toasts = this.service.toasts;
}
