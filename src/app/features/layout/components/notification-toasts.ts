import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationService, notificationRoute } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { AppNotification } from '@core/models/notification.models';

// نوافذ منبثقة للإشعارات اللحظية (مثل إشعارات التطبيقات) — تختفي تلقائياً بعد ثوانٍ
@Component({
  selector: 'app-notification-toasts', standalone: true, imports: [CommonModule],
  template: `
    <section class="toast-stack" aria-live="polite" aria-label="الإشعارات الجديدة">
      @for (t of service.toasts(); track t.notification.id) {
        <article class="toast" role="status">
          <button type="button" class="toast-body" (click)="open(t.notification)">
            <span class="toast-icon" aria-hidden="true">🔔</span>
            <span class="toast-text">
              <strong>{{ t.notification.title }}</strong>
              <span>{{ t.notification.message }}</span>
              <small>الآن</small>
            </span>
          </button>
          <button type="button" class="toast-close" aria-label="إغلاق" (click)="service.dismissToast(t.notification.id)">×</button>
          <span class="toast-progress" aria-hidden="true"></span>
        </article>
      }
    </section>`,
  styleUrl: './notification-toasts.scss'
})
export class NotificationToasts {
  service = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // نقر على إشعار سطح المكتب → نفس سلوك النقر على النافذة المنبثقة
    this.service.desktopClick$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(n => this.open(n));
  }

  open(n: AppNotification) {
    this.service.dismissToast(n.id);
    this.service.markAsRead(n.id).subscribe({ error: () => {} });
    this.router.navigateByUrl(notificationRoute(n, this.auth.canReviewVacations()));
  }
}
