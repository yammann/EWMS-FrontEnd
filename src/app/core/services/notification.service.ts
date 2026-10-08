import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Subject, Subscription, interval, tap, catchError, EMPTY } from 'rxjs';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { ApiService } from './api.service';
import { AppNotification } from '@core/models/notification.models';
import { PagedResult } from '@core/models/maintenance.models';

// الاتصال اللحظي عبر SignalR هو الأساس؛ الاستعلام الدوري البطيء احتياط فقط (لو انقطع الاتصال)
const HUB_URL = '/hubs/notifications';
const FALLBACK_POLL_MS = 60_000;
const TOAST_MS = 7_000;
const MAX_TOASTS = 4;

export interface NotificationToast {
  notification: AppNotification;
  timer: ReturnType<typeof setTimeout>;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private zone = inject(NgZone);
  private hub?: HubConnection;
  private polling?: Subscription;

  unreadCount = signal(0);
  toasts = signal<NotificationToast[]>([]);
  connected = signal(false);
  /** كل إشعار يصل لحظياً — تشترك به الصفحات لتحديث قوائمها بدون إعادة تحميل */
  incoming$ = new Subject<AppNotification>();
  /** نقر على إشعار سطح المكتب — الواجهة تقرر أين تنتقل */
  desktopClick$ = new Subject<AppNotification>();

  my(unreadOnly = false) {
    return this.api.get<AppNotification[]>(`/Notifications/My?unreadOnly=${unreadOnly}`);
  }

  /** صفحة من إشعاراتي (الأحدث أولاً) مع العدد الكلي — لصفحة الإشعارات */
  page(unreadOnly: boolean, page: number, pageSize: number) {
    return this.api.get<PagedResult<AppNotification>>(`/Notifications/Page?unreadOnly=${unreadOnly}&page=${page}&pageSize=${pageSize}`);
  }

  refreshCount() {
    return this.api.get<number>('/Notifications/UnreadCount').pipe(tap(count => this.unreadCount.set(count)));
  }

  markAsRead(id: number) {
    return this.api.put<unknown>(`/Notifications/MarkAsRead/${id}`, {})
      .pipe(tap(() => this.unreadCount.update(c => Math.max(0, c - 1))));
  }

  markAllAsRead() {
    return this.api.put<unknown>('/Notifications/MarkAllAsRead', {}).pipe(tap(() => this.unreadCount.set(0)));
  }

  /* =====================================================
   * الاتصال اللحظي
   * ===================================================== */
  start(accessToken: () => string) {
    if (this.hub) return;

    this.hub = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: accessToken })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.hub.on('notification', (n: AppNotification) => this.zone.run(() => this.receive(n)));
    // بعد انقطاع قد تكون فاتتنا إشعارات — نزامن العدد من الخادم
    this.hub.onreconnected(() => this.zone.run(() => { this.connected.set(true); this.syncCount(); }));
    this.hub.onreconnecting(() => this.zone.run(() => this.connected.set(false)));
    this.hub.onclose(() => this.zone.run(() => this.connected.set(false)));

    this.connect();
    this.syncCount();
    this.polling = interval(FALLBACK_POLL_MS).subscribe(() => {
      this.syncCount();
      // الاتصال أُغلق نهائياً (مثلاً الخادم كان متوقفاً) — نحاول من جديد
      if (this.hub?.state === HubConnectionState.Disconnected) this.connect();
    });
  }

  stop() {
    this.polling?.unsubscribe();
    this.polling = undefined;
    this.hub?.stop();
    this.hub = undefined;
    this.connected.set(false);
    this.unreadCount.set(0);
    this.toasts().forEach(t => clearTimeout(t.timer));
    this.toasts.set([]);
  }

  private connect() {
    this.hub?.start()
      .then(() => this.connected.set(true))
      .catch(() => this.connected.set(false));
  }

  private syncCount() {
    this.refreshCount().pipe(catchError(() => EMPTY)).subscribe();
  }

  private receive(n: AppNotification) {
    this.unreadCount.update(c => c + 1);
    this.incoming$.next(n);
    this.showToast(n);
    this.showDesktop(n);
  }

  /* =====================================================
   * النوافذ المنبثقة داخل التطبيق
   * ===================================================== */
  private showToast(n: AppNotification) {
    const timer = setTimeout(() => this.dismissToast(n.id), TOAST_MS);
    this.toasts.update(list => {
      const next = [{ notification: n, timer }, ...list];
      next.slice(MAX_TOASTS).forEach(t => clearTimeout(t.timer));
      return next.slice(0, MAX_TOASTS);
    });
  }

  dismissToast(id: number) {
    this.toasts.update(list => {
      list.filter(t => t.notification.id === id).forEach(t => clearTimeout(t.timer));
      return list.filter(t => t.notification.id !== id);
    });
  }

  /* =====================================================
   * إشعارات سطح المكتب (عندما يكون التبويب في الخلفية)
   * ===================================================== */
  desktopSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  desktopPermission(): NotificationPermission | 'unsupported' {
    return this.desktopSupported() ? Notification.permission : 'unsupported';
  }

  requestDesktopPermission() {
    if (!this.desktopSupported()) return Promise.resolve('denied' as NotificationPermission);
    return Notification.requestPermission();
  }

  private showDesktop(n: AppNotification) {
    if (!this.desktopSupported() || Notification.permission !== 'granted' || !document.hidden) return;
    const desktop = new Notification(n.title, { body: n.message, tag: `ewms-${n.id}`, lang: 'ar', dir: 'rtl' });
    desktop.onclick = () => this.zone.run(() => {
      window.focus();
      desktop.close();
      this.desktopClick$.next(n);
    });
  }
}

/** الوجهة عند فتح الإشعار: طلبات تنتظر قرار المدير → المراجعة، وغيرها → ملف الموظف */
export function notificationRoute(n: AppNotification, canReview: boolean): string {
  if (n.relatedEntityType === 'WorkTask' && n.relatedEntityId) return `/tasks/${n.relatedEntityId}`;
  if (n.relatedEntityType === 'AssignedTask' && n.relatedEntityId) return `/task-board?task=${n.relatedEntityId}`;
  if (n.relatedEntityType === 'TaskRecurrence') return '/task-board/recurring';
  if (n.relatedEntityType === 'ToDoList' && n.relatedEntityId) return `/todo-lists/${n.relatedEntityId}`;
  if (n.relatedEntityType === 'MaintenanceRequest' && n.relatedEntityId) return `/maintenance/requests/${n.relatedEntityId}`;
  if (n.relatedEntityType === 'MyMaintenanceRequest' && n.relatedEntityId) return `/maintenance/mine?request=${n.relatedEntityId}`;
  if (n.relatedEntityType === 'SparePart' && n.relatedEntityId) return `/maintenance/parts?part=${n.relatedEntityId}`;
  if (n.relatedEntityType === 'MaintenanceTask' && n.relatedEntityId) return `/maintenance/tasks?task=${n.relatedEntityId}`;
  const reviewTypes = ['VacationSubmitted', 'VacationForwardedToBranchManager', 'VacationCancelled'];
  return n.relatedEntityType === 'Vacation' && reviewTypes.includes(n.type) && canReview
    ? '/vacations/review' : '/profile';
}
