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
  selector: 'app-notifications-page', standalone: true, imports: [DatePipe, Pager, Icon],
  styleUrls: ['../shared/organization.scss'],
  template: `
    <div class="page">
      <header class="n-head">
        <div class="n-id">
          <span class="n-badge" aria-hidden="true"><app-icon name="bell" /></span>
          <div>
            <h1>الإشعارات</h1>
            <p class="n-sub">@if (unread()) { <span class="n-pill">{{ unread() }} غير مقروءة</span> } @else { <span>لا إشعارات غير مقروءة</span> }
              <span class="n-dot" aria-hidden="true"></span><span>تحديثات الطلبات والمهام والمفكرة والصيانة</span></p>
          </div>
        </div>
        <div class="n-actions">
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

      <div class="n-pills" role="group" aria-label="تصفية الإشعارات">
        <button type="button" class="p" [class.on]="!unreadOnly()" [attr.aria-pressed]="!unreadOnly()" (click)="setFilter(false)">الكل</button>
        <button type="button" class="p" [class.on]="unreadOnly()" [attr.aria-pressed]="unreadOnly()" (click)="setFilter(true)">غير المقروءة<span class="n">({{ unread() }})</span></button>
      </div>

      @if (loading() && !items().length) { <div class="panel empty-state" role="status">جارٍ تحميل الإشعارات…</div> }
      @else if (!items().length && !error()) {
        <div class="panel empty-state"><div class="n-empty" aria-hidden="true">🔔</div><h3>{{ unreadOnly() ? 'كل شيء مقروء' : 'لا توجد إشعارات' }}</h3>
          <p class="muted">{{ unreadOnly() ? 'لا إشعارات جديدة بانتظارك.' : 'ستظهر هنا تحديثات طلباتك ومهامك عند حدوثها.' }}</p></div>
      } @else {
        @for (g of groups(); track g.title) {
          <section class="n-group">
            <h2>{{ g.title }}</h2>
            <ul class="n-list">
              @for (n of g.items; track n.id) {
                <li class="n-card" [class.unread]="!n.isRead">
                  <button type="button" class="n-main" (click)="open(n)">
                    <span class="n-ico {{ kind(n).tone }}" aria-hidden="true">{{ kind(n).icon }}</span>
                    <span class="n-text">
                      <strong>{{ n.title }}</strong>
                      <span class="msg">{{ n.message }}</span>
                      <small>{{ ago(n.createdAt) || (n.createdAt | date:'yyyy/MM/dd HH:mm') }}</small>
                    </span>
                    @if (!n.isRead) { <span class="n-unread" aria-label="غير مقروء"></span> }
                  </button>
                  @if (!n.isRead) { <button class="n-read" type="button" (click)="markRead(n)" [disabled]="saving()" title="تعليم كمقروء" aria-label="تعليم كمقروء">✓</button> }
                </li>
              }
            </ul>
          </section>
        }
        <app-pager [page]="page()" [pageSize]="size()" [total]="total()" (pageChange)="goTo($event)" (sizeChange)="setSize($event)" />
      }
    </div>`,
  styles: [`
    .page { gap: 20px; }
    .n-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
    .n-id { display: flex; align-items: center; gap: 14px; }
    .n-badge { flex: none; width: 46px; height: 46px; display: grid; place-items: center; border-radius: var(--radius-lg); color: var(--on-brand); background: linear-gradient(135deg, var(--brand-600), var(--brand-700)); box-shadow: var(--shadow-md); }
    .n-badge app-icon { width: 22px; height: 22px; }
    h1 { margin: 0; font-size: 26px; line-height: 1.3; }
    .n-sub { margin: 2px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-500); }
    .n-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-300); }
    .n-pill { padding: 2px 10px; border-radius: var(--radius-full); background: var(--brand-50); color: var(--brand-700); border: 1px solid var(--brand-100); font-size: 12px; font-weight: 800; }
    .n-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .n-pills { display: flex; gap: 8px; }
    .n-pills .p { min-height: 36px; padding: 0 16px; border-radius: var(--radius-full); border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-600); font-size: 13px; font-weight: 700; box-shadow: var(--shadow-sm); }
    .n-pills .p:hover:not(:disabled) { background: var(--fill); color: var(--ink-900); transform: none; box-shadow: var(--shadow-sm); }
    .n-pills .p.on { background: var(--ink-900); color: var(--surface); border-color: var(--ink-900); }
    .n-pills .n { margin-inline-start: 5px; font-variant-numeric: tabular-nums; opacity: .75; }
    .n-group h2 { margin: 4px 0 10px; font-size: 13px; font-weight: 800; color: var(--ink-500); }
    .n-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .n-card { position: relative; display: flex; align-items: stretch; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
      transition: transform .2s cubic-bezier(.16, 1, .3, 1), box-shadow .2s ease, border-color .2s ease; }
    .n-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); border-color: var(--border-strong); }
    .n-card.unread { background: var(--brand-50); border-color: var(--brand-100); }
    .n-main { flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; text-align: start; background: transparent; border: 0; box-shadow: none; color: inherit; font: inherit; font-weight: 400; cursor: pointer; border-radius: var(--radius-xl); }
    .n-main:hover:not(:disabled) { background: transparent; box-shadow: none; transform: none; }
    .n-ico { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; font-size: 19px; }
    .n-ico.green { background: var(--brand-100); } .n-ico.blue { background: var(--info-100); } .n-ico.orange { background: var(--warning-100); }
    .n-ico.purple { background: var(--purple-100); } .n-ico.red { background: var(--danger-100); }
    .n-text { flex: 1; min-width: 0; display: grid; gap: 3px; text-align: start; }
    .n-text strong { font-size: 14.5px; color: var(--ink-900); line-height: 1.5; }
    .msg { font-size: 13px; line-height: 1.8; color: var(--ink-600); overflow-wrap: anywhere; }
    .n-text small { font-size: 12px; color: var(--ink-400); }
    .n-unread { flex: none; width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; background: var(--brand-600); }
    .n-read { align-self: center; flex: none; margin-inline: 4px 12px; width: 34px; min-height: 34px; padding: 0; border-radius: 50%; background: var(--surface); border: 1px solid var(--border-strong); color: var(--ink-500); font-size: 15px; box-shadow: none; }
    .n-read:hover:not(:disabled) { background: var(--brand-600); color: var(--on-brand); border-color: var(--brand-600); transform: none; box-shadow: none; }
    .empty-state { display: grid; justify-items: center; gap: 6px; text-align: center; padding: 40px 16px; }
    .n-empty { font-size: 38px; }
    .empty-state h3 { margin: 0; }
    @media (prefers-reduced-motion: reduce) { .n-card { transition: none; } .n-card:hover { transform: none; } }
  `]
})
export class NotificationsPage {
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
    this.loading.set(true); this.error.set('');
    this.service.refreshCount().subscribe({ error: () => {} });
    this.service.page(this.unreadOnly(), this.page(), this.size()).subscribe({
      next: r => {
        // صفحة تجاوزت الأخيرة (بعد تعليم/حذف) ← نعود لآخر صفحة موجودة
        if (!r.items.length && r.totalCount > 0 && this.page() > 1) { this.page.set(Math.max(1, r.totalPages)); this.load(); return; }
        this.items.set(r.items); this.total.set(r.totalCount); this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
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
    this.saving.set(true); this.error.set('');
    this.service.markAllAsRead().subscribe({
      next: () => { this.saving.set(false); this.page.set(1); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }

  open(n: AppNotification) {
    this.markRead(n, () => this.router.navigateByUrl(notificationRoute(n, this.auth.canReviewVacations())));
  }
}
