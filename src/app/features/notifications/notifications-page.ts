import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationService, notificationRoute } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AppNotification } from '../../core/models/notification.models';


@Component({
  selector: 'app-notifications-page', standalone: true, imports: [CommonModule],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">مركز التنبيهات</span><h1>الإشعارات</h1><p class="muted">تحديثات طلبات الإجازة الخاصة بك وبفريقك</p></div>
        <div class="actions">
          <button class="btn btn-ghost" (click)="load()" [disabled]="loading() || saving()">تحديث</button>
          <button class="btn" (click)="markAll()" [disabled]="saving() || !unread()">تعليم الكل كمقروء</button>
        </div>
      </header>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (desktopPermission() === 'default') {
        <p class="alert alert-success">فعّل إشعارات سطح المكتب لتصلك التنبيهات حتى عندما تكون في تبويب أو برنامج آخر.
          <button class="btn btn-sm" (click)="enableDesktop()">تفعيل إشعارات سطح المكتب</button></p>
      } @else if (desktopPermission() === 'denied') {
        <p class="alert alert-warning">إشعارات سطح المكتب محظورة في المتصفح. يمكنك السماح بها من إعدادات الموقع (رمز القفل بجانب العنوان).</p>
      }
      <section class="panel">
        <div class="panel-heading">
          <h2>{{ unreadOnly() ? 'غير المقروءة' : 'كل الإشعارات' }}</h2>
          <div class="actions">
            <button class="btn btn-sm" [class.btn-ghost]="unreadOnly()" (click)="setFilter(false)">الكل</button>
            <button class="btn btn-sm" [class.btn-ghost]="!unreadOnly()" (click)="setFilter(true)">غير المقروءة ({{ unread() }})</button>
          </div>
        </div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ تحميل الإشعارات…</p> }
        @else if (!items().length && !error()) { <div class="empty-state"><h3>لا توجد إشعارات</h3><p>ستظهر هنا تحديثات طلبات الإجازة عند حدوثها.</p></div> }
        @else {
          <ul class="notification-list">
            @for (n of items(); track n.id) {
              <li class="notification" [class.unread]="!n.isRead">
                <button type="button" class="notification-body" (click)="open(n)">
                  <strong>{{ n.title }}</strong>
                  <span class="wrap">{{ n.message }}</span>
                  <small class="muted">{{ n.createdAt | date:'yyyy/MM/dd HH:mm' }}</small>
                </button>
                @if (!n.isRead) { <button class="btn btn-ghost btn-sm" (click)="markRead(n)" [disabled]="saving()">تعليم كمقروء</button> }
              </li>
            }
          </ul>
        }
      </section>
    </div>`,
  styles: [`
    .notification-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .notification { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
    .notification.unread { border-color: var(--brand-500); background: var(--brand-50); }
    .notification-body { flex: 1; display: grid; gap: 6px; text-align: start; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; color: inherit; }
    /* نلغي تأثير button:hover العام (خلفية خضراء) — عند المرور يتغير لون الإطار فقط */
    .notification { transition: border-color .15s ease; }
    .notification:hover { border-color: var(--brand-600); }
    .notification-body:hover:not(:disabled) { background: none; box-shadow: none; transform: none; }
    .notification.unread strong::before { content: "● "; color: var(--brand-600); }
  `]
})
export class NotificationsPage {
  private service = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  items = signal<AppNotification[]>([]);
  unreadOnly = signal(false);
  loading = signal(false); saving = signal(false); error = signal('');
  unread = computed(() => this.service.unreadCount());
  desktopPermission = signal(this.service.desktopPermission());

  constructor() {
    this.load();
    // الإشعارات الجديدة تُضاف أعلى القائمة فور وصولها — بدون إعادة تحميل
    this.service.incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (!this.items().some(x => x.id === n.id)) this.items.update(list => [n, ...list]);
    });
  }

  enableDesktop() {
    this.service.requestDesktopPermission().then(p => this.desktopPermission.set(p));
  }

  setFilter(unreadOnly: boolean) { this.unreadOnly.set(unreadOnly); this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.refreshCount().subscribe({ error: () => {} });
    this.service.my(this.unreadOnly()).subscribe({
      next: v => { this.items.set(v); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  markRead(n: AppNotification, after?: () => void) {
    if (n.isRead) { after?.(); return; }
    this.saving.set(true);
    this.service.markAsRead(n.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.items.update(list => this.unreadOnly()
          ? list.filter(x => x.id !== n.id)
          : list.map(x => x.id === n.id ? { ...x, isRead: true } : x));
        after?.();
      },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }

  markAll() {
    this.saving.set(true); this.error.set('');
    this.service.markAllAsRead().subscribe({
      next: () => { this.saving.set(false); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }

  open(n: AppNotification) {
    this.markRead(n, () => this.router.navigateByUrl(notificationRoute(n, this.auth.canReviewVacations())));
  }
}
