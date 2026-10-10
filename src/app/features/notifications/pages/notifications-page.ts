import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationService, notificationRoute } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { AppNotification } from '@core/models/notification.models';
import { storePageSize, storedPageSize } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Icon } from '@shared/ui/icon';
import { Alert } from '@shared/ui/alert';
import { latestRequest, trackRequest } from '@shared/ui/track-request';

type Tone = 'green' | 'blue' | 'orange' | 'purple' | 'red';
interface Kind { icon: string; tone: Tone; }

/** رمز ولون الإشعار حسب نوعه */
function kindOf(type: string): Kind {
  if (type.startsWith('Vacation')) return { icon: '🌴', tone: type.includes('Rejected') || type === 'VacationCancelled' ? 'red' : 'green' };
  if (type.startsWith('ToDo')) return { icon: '📝', tone: type.includes('Overdue') ? 'red' : 'purple' };
  if (type === 'TaskOverdue') return { icon: '⏰', tone: 'red' };
  if (type === 'TaskDueSoon') return { icon: '⏳', tone: 'orange' };
  if (type.startsWith('Task') || type === 'WorkTaskAssigned') return { icon: '📋', tone: 'blue' };
  if (type === 'SparePartLowStock') return { icon: '📦', tone: 'orange' };
  if (type.startsWith('Maintenance')) return { icon: '🔧', tone: 'orange' };
  return { icon: '🔔', tone: 'blue' };
}

const DAY = 86_400_000;
const dayLabel = (iso: string) => {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? 'اليوم' : days === 1 ? 'أمس' : 'أقدم';
};
/** «منذ 5 دقائق» للأحدث، وإلا التاريخ والوقت */
function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} ${mins === 1 ? 'دقيقة' : mins === 2 ? 'دقيقتين' : mins <= 10 ? 'دقائق' : 'دقيقة'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'}`;
  return '';
}

/**
 * مركز الإشعارات: رأس بأيقونة وحبّة غير المقروء، حبّات «الكل / غير المقروءة»، وبطاقات مجمّعة باليوم
 * (أيقونة ملوّنة حسب النوع، النص بمحاذاة بداية السطر، نقطة وتظليل لغير المقروء، ووقت نسبي).
 * التقسيم من الخادم (Notifications/Page)، والإشعار اللحظي يُضاف أعلى الصفحة الأولى.
 */
@Component({
  selector: 'app-notifications-page', standalone: true, imports: [Alert, DatePipe, Pager, Icon],
  styleUrls: ['../../../shared/styles/page-base.scss', './notifications-page.scss'],
  templateUrl: './notifications-page.html',
  
})
export class NotificationsPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);

  items = signal<AppNotification[]>([]);
  unreadOnly = signal(false);
  page = signal(1);
  size = signal(storedPageSize(10, [10, 25, 50]));
  total = signal(0);
  loading = signal(false); saving = signal(false); error = signal('');
  unread = computed(() => this.service.unreadCount());
  desktopPermission = signal(this.service.desktopPermission());

  kind = (n: AppNotification) => kindOf(n.type);
  ago = ago;

  /** التجميع داخل الصفحة الحالية: اليوم / أمس / أقدم */
  groups = computed(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of this.items()) {
      const key = dayLabel(n.createdAt);
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return [...map].map(([title, items]) => ({ title, items }));
  });

  constructor() {
    this.load();
    // الإشعار اللحظي يُضاف أعلى الصفحة الأولى (بغير الإخلال بالعدد المعروض)، وفي غيرها يُحدَّث العدد فقط
    this.service.incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (this.items().some(x => x.id === n.id)) return;
      this.total.update(t => t + 1);
      if (this.page() === 1) this.items.update(list => [n, ...list].slice(0, this.size()));
    });
  }

  enableDesktop() {
    this.service.requestDesktopPermission().then(p => this.desktopPermission.set(p));
  }

  setFilter(unreadOnly: boolean) { this.unreadOnly.set(unreadOnly); this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }
  setSize(size: number) { this.size.set(size); storePageSize(size); this.page.set(1); this.load(); }

  load() {
    this.service.refreshCount().subscribe({ error: () => {} });
    this.latest(this.service.page(this.unreadOnly(), this.page(), this.size()), this.loading, this.error, r => {
      // صفحة تجاوزت الأخيرة (بعد تعليم/حذف) ← نعود لآخر صفحة موجودة
      if (!r.items.length && r.totalCount > 0 && this.page() > 1) { this.page.set(Math.max(1, r.totalPages)); this.load(); return; }
      this.items.set(r.items); this.total.set(r.totalCount);
    });
  }

  markRead(n: AppNotification, after?: () => void) {
    if (n.isRead) { after?.(); return; }
    this.saving.set(true);
    this.service.markAsRead(n.id).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.unreadOnly()) this.load();                       // تخرج من «غير المقروءة»: أعد تحميل الصفحة
        else this.items.update(list => list.map(x => x.id === n.id ? { ...x, isRead: true } : x));
        after?.();
      },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }

  markAll() {
    trackRequest(this.service.markAllAsRead(), this.saving, this.error, () => { this.page.set(1); this.load(); });
  }

  open(n: AppNotification) {
    this.markRead(n, () => this.router.navigateByUrl(notificationRoute(n, this.auth.canReviewVacations())));
  }
}
