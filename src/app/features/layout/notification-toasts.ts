import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationService, notificationRoute } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AppNotification } from '../../core/models/notification.models';

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
  styles: [`
    .toast-stack { position: fixed; top: 20px; inset-inline-end: 20px; z-index: 1000; display: grid; gap: 12px; width: min(380px, calc(100vw - 32px)); pointer-events: none; }
    .toast { pointer-events: auto; position: relative; overflow: hidden; display: flex; align-items: flex-start; gap: 4px; background: #fff; border: 1px solid var(--border, #e5e7eb); border-inline-start: 4px solid var(--brand-500, #007a3d); border-radius: 14px; box-shadow: 0 12px 32px rgba(15, 23, 42, .18); animation: toast-in .28s ease-out; }
    .toast-body { flex: 1; display: flex; gap: 12px; align-items: flex-start; padding: 14px 4px 16px 14px; padding-inline-start: 14px; background: none; border: 0; text-align: start; font: inherit; color: inherit; cursor: pointer; }
    /* نلغي تأثير button:hover العام (خلفية خضراء) — عند المرور يتغير لون الإطار فقط */
    .toast { transition: border-color .15s ease; }
    .toast:hover { border-color: var(--brand-600, #006432); }
    .toast-body:hover:not(:disabled) { background: none; box-shadow: none; transform: none; }
    .toast-icon { flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--brand-50, #e8f5ee); font-size: 17px; }
    .toast-text { display: grid; gap: 4px; min-width: 0; }
    .toast-text strong { font-size: 14px; color: var(--ink-900, #0f172a); }
    .toast-text span { font-size: 13px; line-height: 1.6; color: var(--ink-600, #475569); overflow-wrap: anywhere; }
    .toast-text small { font-size: 11px; color: var(--ink-400, #94a3b8); }
    .toast-close { flex: none; margin: 8px; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-400, #94a3b8); font-size: 20px; line-height: 1; cursor: pointer; }
    .toast-close:hover { background: var(--ink-50, #f1f5f9); color: var(--ink-700, #334155); }
    .toast-progress { position: absolute; bottom: 0; inset-inline-start: 0; height: 3px; width: 100%; background: var(--brand-500, #007a3d); opacity: .5; transform-origin: right; animation: toast-timer 7s linear forwards; }
    .toast:hover .toast-progress { animation-play-state: paused; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-12px) scale(.97); } to { opacity: 1; transform: none; } }
    @keyframes toast-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } .toast-progress { display: none; } }
  `]
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
