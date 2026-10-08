import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationToasts } from './notification-toasts';
import { Toasts } from '../../shared/ui/toasts';
import { ConfirmHost } from '../../shared/ui/confirm-host';
import { Logo } from '../../shared/ui/logo';
import { Icon, IconName } from '../../shared/ui/icon';
import { AppearanceMenu } from './appearance-menu';
import { roleLabel } from '../../core/utils/roles';
import { AppPermission, AppPermissionName, MANAGE_DEPARTMENTS, MANAGE_MAINTENANCE_LOOKUPS, MANAGE_VACATION_TYPES, VACATION_STATS, DEVICE_ACCESS, DASHBOARD_ACCESS, TASK_ASSIGN } from '../../core/constants/access';

const SIDEBAR_KEY = 'ewms_sidebar';

interface NavItem { path: string; label: string; icon: IconName; exact?: boolean; }
interface NavSection { id: 'main' | 'vacations' | 'maintenance' | 'devices' | 'admin'; title: string; items: NavItem[]; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationToasts, Toasts, ConfirmHost, Logo, Icon, AppearanceMenu],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
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
    // اتصال لحظي (SignalR) لاستقبال الإشعارات فور حدوثها
    // (لمن يملك ViewNotifications فقط — الباكاند يرفض الاتصال لغيره)
    effect(() => { if (this.canNotify()) untracked(() => this.notifications.start(() => this.auth.getToken() ?? '')); });
    this.loadSidebar();
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
      { id: 'main', title: '', items: [
        canAny(DASHBOARD_ACCESS) && { path: '/', label: 'لوحة المتابعة', icon: 'home', exact: true },
        can(AppPermission.ViewTaskBoard) && { path: '/task-board', label: 'لوحة المهام', icon: 'board', exact: true },
        canAny(TASK_ASSIGN) && { path: '/task-board/recurring', label: 'المهام الدورية والقوالب', icon: 'calendar' },
        can(AppPermission.ViewTaskStats) && { path: '/task-board/stats', label: 'إحصائيات المهام', icon: 'chart' }
      ].filter(Boolean) as NavItem[] },
      { id: 'vacations', title: 'الإجازات', items: [
        this.auth.canReviewVacations() && { path: '/vacations/review', label: 'مراجعة الإجازات', icon: 'check' },
        canAny(VACATION_STATS) && { path: '/vacations/stats', label: 'إحصائيات الإجازات', icon: 'chart' },
        canAny(MANAGE_VACATION_TYPES) && { path: '/vacation-types', label: 'أنواع الإجازات', icon: 'tag' },
        can(AppPermission.ViewHolidays) && { path: '/vacations/holidays', label: 'العطل الرسمية', icon: 'calendar' }
      ].filter(Boolean) as NavItem[] },
      { id: 'maintenance', title: 'الصيانة', items: [
        can(AppPermission.ViewMaintenanceRequests) && { path: '/maintenance/requests', label: 'طلبات الصيانة', icon: 'wrench' },
        can(AppPermission.ViewMaintenanceDevices) && { path: '/maintenance/devices', label: 'أجهزة الصيانة', icon: 'device' },
        can(AppPermission.ViewSpareParts) && { path: '/maintenance/parts', label: 'قطع الغيار', icon: 'box', exact: true },
        can(AppPermission.ViewSparePartReports) && { path: '/maintenance/parts/report', label: 'تقارير قطع الغيار', icon: 'chart' },
        can(AppPermission.ViewMyMaintenanceRequests) && { path: '/maintenance/mine', label: 'أجهزتي في الصيانة', icon: 'user' },
        can(AppPermission.ViewMaintenanceTasks) && { path: '/maintenance/tasks', label: 'مهام الصيانة', icon: 'clipboard' },
        can(AppPermission.ViewMaintenanceStats) && { path: '/maintenance/stats', label: 'إحصائيات الصيانة', icon: 'chart' },
        canAny(MANAGE_MAINTENANCE_LOOKUPS) && { path: '/maintenance/settings', label: 'إعدادات الصيانة', icon: 'gear' }
      ].filter(Boolean) as NavItem[] },
      { id: 'devices', title: 'توثيق الأجهزة', items: canAny(DEVICE_ACCESS) ? [
        { path: '/devices/installations', label: 'التركيبات', icon: 'device' },
        { path: '/devices/sites', label: 'المواقع', icon: 'landmark' },
        { path: '/devices/catalog', label: 'الأجهزة', icon: 'layers' }
      ] : [] },
      { id: 'admin', title: 'الإدارة', items: [
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

  /** حالة السايدبار المحفوظة: مطوي (أيقونات فقط) + الأقسام المغلقة */
  readonly collapsed = signal(false);
  readonly closedSections = signal<ReadonlySet<string>>(new Set());

  isOpen(section: NavSection) { return !section.title || !this.closedSections().has(section.id); }

  /** قسم مغلق يحتوي الصفحة الحالية — تظهر نقطة بجانب عنوانه */
  hasActive(section: NavSection) {
    const url = this.url().split('?')[0];
    return section.items.some(i => i.exact ? url === i.path : url === i.path || url.startsWith(i.path + '/'));
  }

  toggleSidebar() {
    this.collapsed.update(v => !v);
    this.saveSidebar();
  }

  toggleSection(section: NavSection) {
    this.closedSections.update(set => {
      const next = new Set(set);
      next.has(section.id) ? next.delete(section.id) : next.add(section.id);
      return next;
    });
    this.saveSidebar();
  }

  private loadSidebar() {
    try {
      const saved = JSON.parse(localStorage.getItem(SIDEBAR_KEY) ?? 'null');
      this.collapsed.set(saved?.collapsed === true);
      this.closedSections.set(new Set(Array.isArray(saved?.closed) ? saved.closed : []));
    } catch { /* التخزين غير متاح — الإعداد الافتراضي */ }
  }

  private saveSidebar() {
    try { localStorage.setItem(SIDEBAR_KEY, JSON.stringify({ collapsed: this.collapsed(), closed: [...this.closedSections()] })); }
    catch { /* تجاهل */ }
  }

  logout() {
    this.auth.logout();
  }
}
