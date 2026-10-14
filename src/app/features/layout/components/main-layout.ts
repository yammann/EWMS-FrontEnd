import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { NotificationToasts } from './notification-toasts';
import { Toasts } from '@shared/ui/toasts';
import { ConfirmHost } from '@shared/ui/confirm-host';
import { TruncationTipService } from '@shared/ui/truncation-tip.service';
import { Logo } from '@shared/ui/logo';
import { Icon, IconName } from '@shared/ui/icon';
import { AppearanceMenu } from './appearance-menu';
import { BackButton } from '@shared/ui/back-button';
import { hasOpenModal } from '@shared/ui/modal';
import { roleLabel } from '@core/utils/roles';
import { AppPermission, AppPermissionName, MANAGE_DEPARTMENTS, MANAGE_MAINTENANCE_LOOKUPS, MANAGE_VACATION_TYPES, VACATION_STATS, DEVICE_ACCESS, SITE_ACCESS, MAP_LAYER_ACCESS, DASHBOARD_ACCESS, TASK_ASSIGN, REPORT_ACCESS, MY_VACATIONS_ACCESS } from '@core/constants/access';

const SIDEBAR_KEY = 'ewms_sidebar';
/** عرض الشاشة الذي تتحول عنده القائمة إلى أزرار تُفتح بزر «القائمة» (مطابق لـ @media في main-layout-compact.scss) */
const COMPACT_QUERY = '(max-width: 860px)';
/** «تقليل الحركة» في إعدادات النظام */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface NavItem { path: string; label: string; icon: IconName; exact?: boolean; }
/** icon: أيقونة القسم في السايدبار المطوي (تنسدل تحتها أيقونات صفحاته) */
interface NavSection { id: 'main' | 'tasks' | 'vacations' | 'maintenance' | 'sites' | 'devices' | 'reports' | 'admin'; title: string; icon: IconName; items: NavItem[]; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationToasts, Toasts, ConfirmHost, Logo, Icon, AppearanceMenu, BackButton],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss', './main-layout-rail.scss', './main-layout-motion.scss', './main-layout-compact.scss'],
  host: { '(document:keydown.escape)': 'closeMenu()', '(window:resize)': 'placeIndicator(false)' }
})
export class MainLayout {
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);
  user = this.auth.currentUser;
  unreadCount = this.notifications.unreadCount;
  canNotify = computed(() => this.auth.hasPermission(AppPermission.ViewNotifications));
  roleLabel = roleLabel;
  /** للنافبار: الاسم الأول والحرف الأول للصورة الرمزية */
  private displayName = computed(() => (this.user()?.fullName || this.user()?.email || '').trim());
  firstName = computed(() => this.displayName().split(/\s+/)[0] ?? '');
  initial = computed(() => this.displayName().charAt(0).toUpperCase() || '؟');

  constructor() {
    inject(TruncationTipService).start();      // تعليق النص الكامل للمقصوص في كل الصفحات
    // اتصال لحظي (SignalR) لاستقبال الإشعارات فور حدوثها
    // (لمن يملك ViewNotifications فقط — الباكاند يرفض الاتصال لغيره)
    effect(() => { if (this.canNotify()) untracked(() => this.notifications.start(() => this.auth.getToken() ?? '')); });
    this.loadSidebar();
    this.watchCompact();
    // اختيار رابط يغلق القائمة على الشاشات الصغيرة
    effect(() => { this.url(); untracked(() => { this.menuOpen.set(false); setTimeout(() => this.placeIndicator(true)); }); });
    // تغيّر الروابط (الصلاحيات) أو أول رسم: المؤشر يتبع الروابط أثناء حركة ظهورها
    effect(() => { this.sections(); untracked(() => setTimeout(() => this.followIndicator())); });
    afterNextRender(() => this.followIndicator(700));
    // الصلاحيات الفعّالة قد تتغيّر بعد تسجيل الدخول (إسناد خدمة لوحدتي، تعديل دوري)
    this.auth.refreshPermissions();
  }

  /* =====================================================
   * السايدبار: الروابط حسب الصلاحيات، أقسام قابلة للطي، ووضع الأيقونات فقط
   * ===================================================== */
  private router = inject(Router);
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });

  readonly sections = computed<NavSection[]>(() => {
    const can = (p: AppPermissionName) => this.auth.hasPermission(p);
    const canAny = (list: readonly AppPermissionName[]) => this.auth.hasAnyPermission(list);
    const all: NavSection[] = [
      { id: 'main', title: '', icon: 'home', items: [
        canAny(DASHBOARD_ACCESS) && { path: '/', label: 'لوحة المتابعة', icon: 'home', exact: true },
      ].filter(Boolean) as NavItem[] },
      { id: 'tasks', title: 'المهام', icon: 'checklist', items: [
        can(AppPermission.ViewTaskBoard) && { path: '/task-board', label: 'لوحة المهام', icon: 'board', exact: true },
        can(AppPermission.ViewToDoLists) && { path: '/todo-lists', label: 'مفكرتي', icon: 'clipboard' },
        canAny(TASK_ASSIGN) && { path: '/task-board/recurring', label: 'المهام الدورية والقوالب', icon: 'calendar' },
        can(AppPermission.ViewTaskStats) && { path: '/task-board/stats', label: 'إحصائيات المهام', icon: 'chart' }
      ].filter(Boolean) as NavItem[] },
      { id: 'vacations', title: 'الإجازات', icon: 'suitcase', items: [
        canAny(MY_VACATIONS_ACCESS) && { path: '/vacations/my', label: 'إجازاتي', icon: 'beach' },
        this.auth.canReviewVacations() && { path: '/vacations/review', label: 'مراجعة الإجازات', icon: 'check' },
        canAny(VACATION_STATS) && { path: '/vacations/stats', label: 'إحصائيات الإجازات', icon: 'chart' },
        canAny(MANAGE_VACATION_TYPES) && { path: '/vacation-types', label: 'أنواع الإجازات', icon: 'tag' },
        can(AppPermission.ViewHolidays) && { path: '/vacations/holidays', label: 'العطل الرسمية', icon: 'calendar' }
      ].filter(Boolean) as NavItem[] },
      { id: 'maintenance', title: 'الصيانة', icon: 'toolbox', items: [
        can(AppPermission.ViewMaintenanceRequests) && { path: '/maintenance/requests', label: 'طلبات الصيانة', icon: 'wrench' },
        can(AppPermission.ViewMaintenanceDevices) && { path: '/maintenance/devices', label: 'أجهزة الصيانة', icon: 'device' },
        can(AppPermission.ViewSpareParts) && { path: '/maintenance/parts', label: 'قطع الغيار', icon: 'box', exact: true },
        can(AppPermission.ViewSparePartReports) && { path: '/maintenance/parts/report', label: 'تقارير قطع الغيار', icon: 'chart' },
        can(AppPermission.ViewMyMaintenanceRequests) && { path: '/maintenance/mine', label: 'أجهزتي في الصيانة', icon: 'user' },
        can(AppPermission.ViewMaintenanceTasks) && { path: '/maintenance/tasks', label: 'مهام الصيانة', icon: 'clipboard' },
        can(AppPermission.ViewMaintenanceStats) && { path: '/maintenance/stats', label: 'إحصائيات الصيانة', icon: 'chart' },
        canAny(MANAGE_MAINTENANCE_LOOKUPS) && { path: '/maintenance/settings', label: 'إعدادات الصيانة', icon: 'gear' }
      ].filter(Boolean) as NavItem[] },
      { id: 'sites', title: 'الخريطة والمواقع', icon: 'placeGround', items: [
        canAny(SITE_ACCESS) && { path: '/devices/sites', label: 'المواقع', icon: 'map' },
        canAny(MAP_LAYER_ACCESS) && { path: '/map-layers', label: 'طبقات الفروع', icon: 'layers' }
      ].filter(Boolean) as NavItem[] },
      { id: 'devices', title: 'توثيق الأجهزة', icon: 'serverRack', items: canAny(DEVICE_ACCESS) ? [
        { path: '/devices/installations', label: 'التركيبات', icon: 'device' },
        { path: '/devices/catalog', label: 'الأجهزة', icon: 'box' }
      ] : [] },
      { id: 'reports', title: 'التقارير', icon: 'folderChart', items: [
        canAny(REPORT_ACCESS) && { path: '/reports', label: 'مركز التقارير', icon: 'docText', exact: true },
        can(AppPermission.ViewReportLog) && { path: '/reports/log', label: 'سجل سحب التقارير', icon: 'clock' }
      ].filter(Boolean) as NavItem[] },
      { id: 'admin', title: 'الإدارة', icon: 'orgChart', items: [
        can(AppPermission.ViewWorkTasks) && { path: '/work-tasks', label: 'مهام العمل', icon: 'briefcase' },
        can(AppPermission.ViewBranches) && { path: '/branches', label: 'الفروع', icon: 'landmark' },
        canAny(MANAGE_DEPARTMENTS) && { path: '/departments', label: 'الأقسام', icon: 'building' },
        can(AppPermission.ViewOffices) && { path: '/offices', label: 'المكاتب', icon: 'door' },
        can(AppPermission.ViewUsers) && { path: '/users', label: 'الموظفون', icon: 'users' },
        can(AppPermission.ViewRoles) && { path: '/roles', label: 'الأدوار', icon: 'shield' },
      ].filter(Boolean) as NavItem[] }
    ];
    return all.filter(section => section.items.length);
  });

  /** شاشة ضيقة: الروابط شبكة أزرار بعناوين أقسامها، مغلقة حتى زر «القائمة» (حالة الفتح لا تُحفظ) */
  readonly compact = signal(false);
  readonly menuOpen = signal(false);

  private watchCompact() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(COMPACT_QUERY);
    const apply = () => { this.compact.set(query.matches); if (!query.matches) this.menuOpen.set(false); };
    apply();
    query.addEventListener('change', apply);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', apply));
  }

  /** Esc يغلق القائمة (ما لم تكن نافذة مفتوحة فوقها — Esc لها) */
  closeMenu() {
    if (this.menuOpen() && !hasOpenModal()) this.menuOpen.set(false);
  }

  /**
   * حالة السايدبار المحفوظة: مطوي (أيقونات فقط) + الأقسام المغلقة في الوضع الموسّع
   * + القسم المفتوح في الوضع المطوي (railOpen): كل قسم أيقونة تنسدل تحتها صفحاته، قسم واحد في كل مرة،
   * ويبقى آخر قسم فُتح مفتوحاً (قرار المستخدم 2026-10-13). القسم الأول بلا عنوان فتظهر صفحاته دائماً.
   */
  readonly collapsed = signal(false);
  readonly closedSections = signal<ReadonlySet<string>>(new Set());
  readonly railOpen = signal<string | null>(null);

  isOpen(section: NavSection) { return !section.title || !this.closedSections().has(section.id); }

  /** روابط القسم مطوية: في الوضع المطوي إلا القسم المفتوح، وفي الموسّع حسب طي القسم، ولا شيء على الشاشة الصغيرة */
  groupClosed(section: NavSection) {
    if (this.compact()) return false;
    if (this.collapsed()) return !!section.title && this.railOpen() !== section.id;
    return !this.isOpen(section);
  }

  toggleRail(section: NavSection) {
    this.railOpen.update(id => id === section.id ? null : section.id);
    this.saveSidebar();
    this.followIndicator();
  }

  /** قسم مغلق يحتوي الصفحة الحالية — تظهر نقطة بجانب عنوانه */
  hasActive(section: NavSection) {
    const url = this.url().split('?')[0];
    return section.items.some(i => i.exact ? url === i.path : url === i.path || url.startsWith(i.path + '/'));
  }

  /**
   * الطي: تتلاشى الأسماء أولاً (collapsing) ثم يضيق السايدبار؛ التوسيع: يتسع ثم تظهر الأسماء بالتتابع (expanding).
   * مع «تقليل الحركة» في النظام يتغيّر فوراً.
   */
  readonly motion = signal<'' | 'collapsing' | 'settling' | 'expanding'>('');
  private motionTimer?: ReturnType<typeof setTimeout>;

  toggleSidebar() {
    clearTimeout(this.motionTimer);
    const collapse = !this.collapsed();
    if (collapse && !reducedMotion()) {
      this.motion.set('collapsing');
      this.motionTimer = setTimeout(() => {
        // التبديل إلى الأيقونات: يظهر العمود الجديد بتلاشٍ واحد بلا طيّ الأقسام أثناءه
        this.collapsed.set(true); this.motion.set('settling'); this.saveSidebar(); this.followIndicator(700);
        this.motionTimer = setTimeout(() => this.motion.set(''), 450);
      }, 140);
      return;
    }
    this.collapsed.set(collapse);
    this.motion.set(collapse || reducedMotion() ? '' : 'expanding');
    if (!collapse) this.motionTimer = setTimeout(() => this.motion.set(''), 800);
    this.saveSidebar();
    this.followIndicator();
  }

  /** مؤشر الصفحة الحالية: خلفية واحدة تنزلق إلى الرابط النشط (تختفي إن كان رابطه داخل قسم مطوي) */
  private navRef = viewChild<ElementRef<HTMLElement>>('navEl');
  private indicatorRef = viewChild<ElementRef<HTMLElement>>('indicator');
  private followUntil = 0;
  private following = false;

  placeIndicator(animate: boolean) {
    const nav = this.navRef()?.nativeElement, indicator = this.indicatorRef()?.nativeElement;
    if (!nav || !indicator) return;
    const link = nav.querySelector<HTMLElement>('a.active');
    const box = link?.getBoundingClientRect();
    if (!link || !box?.height || this.compact() || link.closest('.nav-group.closed')) { indicator.style.opacity = '0'; return; }
    const origin = nav.getBoundingClientRect();
    indicator.style.transition = animate && !reducedMotion() ? '' : 'none';
    indicator.style.width = box.width + 'px';
    indicator.style.height = box.height + 'px';
    indicator.style.transform = `translate(${box.left - origin.left}px, ${box.top - origin.top}px)`;
    indicator.style.opacity = '1';
  }

  /** أثناء طي/فتح قسم أو السايدبار تتحرك الروابط: المؤشر يلحق بها إطاراً بإطار */
  private followIndicator(ms = 550) {
    this.followUntil = performance.now() + ms;
    if (this.following || typeof requestAnimationFrame !== 'function') return;
    this.following = true;
    const step = () => {
      this.placeIndicator(false);
      if (performance.now() < this.followUntil) requestAnimationFrame(step); else this.following = false;
    };
    requestAnimationFrame(step);
  }

  toggleSection(section: NavSection) {
    this.closedSections.update(set => {
      const next = new Set(set);
      next.has(section.id) ? next.delete(section.id) : next.add(section.id);
      return next;
    });
    this.saveSidebar();
    this.followIndicator();
  }

  private loadSidebar() {
    try {
      const saved = JSON.parse(localStorage.getItem(SIDEBAR_KEY) ?? 'null');
      this.collapsed.set(saved?.collapsed === true);
      this.closedSections.set(new Set(Array.isArray(saved?.closed) ? saved.closed : []));
      this.railOpen.set(typeof saved?.rail === 'string' ? saved.rail : null);
    } catch { /* التخزين غير متاح — الإعداد الافتراضي */ }
  }

  private saveSidebar() {
    try { localStorage.setItem(SIDEBAR_KEY, JSON.stringify({ collapsed: this.collapsed(), closed: [...this.closedSections()], rail: this.railOpen() })); }
    catch { /* تجاهل */ }
  }

  logout() {
    this.auth.logout();
  }
}
