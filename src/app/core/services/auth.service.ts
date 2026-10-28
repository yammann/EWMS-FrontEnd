import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { NotificationService } from '@core/services/notification.service';
import { LoginRequest } from '@core/models/login-request.model';
import { AuthResponse, AuthUser } from '@core/models/auth-response.model';
import { APPROVE_VACATIONS, AppPermissionName, TASK_OVERSIGHT } from '@core/constants/access';
import { CHECK_EVERY_MS, shouldRenew } from '@core/utils/session-renewal';

const TOKEN_KEY = 'ewms_token';
const USER_KEY = 'ewms_user';

/** localStorage قد يرمي (وضع التصفح الخاص / تخزين محظور) — الجلسة تبقى في الذاكرة عندها */
const storage = {
  get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* تجاهل */ } },
  remove: (key: string) => { try { localStorage.removeItem(key); } catch { /* تجاهل */ } }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private notifications = inject(NotificationService);

  /** التوكن في الذاكرة أيضاً — لا نقرأ التخزين مع كل طلب */
  private token = signal<string | null>(storage.get(TOKEN_KEY));

  currentUser = signal<AuthUser | null>(this.loadUser());

  constructor() {
    // بعد إعادة تحميل الصفحة تُستأنف مراقبة التجديد لجلسة قائمة
    if (this.token() && this.currentUser()) this.startRenewalWatch();
  }

  role = computed(() => this.currentUser()?.role ?? '');
  /** يسند المهام أو يتولى مهام وحدته (صلاحيات لوحة المهام) */
  isLeader = computed(() => this.hasAnyPermission(TASK_OVERSIGHT));
  /** الموافقة الأولى أو الاعتماد النهائي — نفس فحص الباكاند في PendingForMe / Approve */
  canReviewVacations = computed(() => this.hasAnyPermission(APPROVE_VACATIONS));

  login(request: LoginRequest) {
    return this.api.post<AuthResponse>('/Auth/login', request).pipe(tap(response => this.applySession(response)));
  }

  /** يحفظ جلسة جديدة (دخول أو تجديد): التوكن والمستخدم وصلاحياته، ويبدأ مراقبة التجديد */
  private applySession(response: AuthResponse) {
    const user: AuthUser = {
      email: response.email,
      fullName: response.fullName,
      role: response.role,
      branchId: response.branchId,
      departmentId: response.departmentId,
      officeId: response.officeId,
      expiresAt: response.expiresAt,
      permissions: response.permissions ?? []
    };

    this.token.set(response.token);
    storage.set(TOKEN_KEY, response.token);
    storage.set(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
    this.startRenewalWatch();
  }

  // ───────── تجديد الجلسة (session-renewal.ts) ─────────
  private lastActivity = Date.now();
  private renewing = false;
  private renewalTimer: ReturnType<typeof setInterval> | null = null;
  private readonly markActive = () => { this.lastActivity = Date.now(); };
  private readonly onVisible = () => { if (document.visibilityState === 'visible') this.checkRenewal(); };

  /** يراقب نشاط المستخدم ويجدّد الجلسة قبل انتهائها؛ آمن للاستدعاء المتكرر */
  startRenewalWatch() {
    if (this.renewalTimer || typeof document === 'undefined') return;
    for (const event of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(event, this.markActive, { passive: true });
    document.addEventListener('visibilitychange', this.onVisible);
    this.renewalTimer = setInterval(() => this.checkRenewal(), CHECK_EVERY_MS);
    this.checkRenewal();
  }

  private stopRenewalWatch() {
    if (!this.renewalTimer) return;
    clearInterval(this.renewalTimer);
    this.renewalTimer = null;
    for (const event of ['pointerdown', 'keydown', 'touchstart']) document.removeEventListener(event, this.markActive);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private checkRenewal() {
    if (this.renewing || !this.token()) return;
    const expires = Date.parse(this.currentUser()?.expiresAt ?? '');
    if (!shouldRenew(Date.now(), expires, this.lastActivity)) return;

    this.renewing = true;
    // فشل التجديد بـ401 (بلغت الجلسة حدّها) يعالجه jwtInterceptor بإنهاء الجلسة؛ غير ذلك نعيد المحاولة في الدورة التالية
    this.api.post<AuthResponse>('/Auth/Renew', {}).subscribe({
      next: response => { this.applySession(response); this.renewing = false; },
      error: () => { this.renewing = false; }
    });
  }

  /**
   * يحدّث قائمة الصلاحيات من الخادم (عند فتح التطبيق): تتغيّر بتعديل الدور أو إسناد الخدمات أو نقل الموظف،
   * فلا يحتاج المستخدم لإعادة تسجيل الدخول — يكفي تحديث الصفحة. الفشل يُهمل (تبقى القائمة المحفوظة).
   */
  refreshPermissions() {
    if (!this.isAuthenticated()) return;
    this.api.get<{ permissions: string[] }>('/Auth/Permissions').subscribe({
      next: ({ permissions }) => {
        const user = this.currentUser();
        if (!user || JSON.stringify(user.permissions) === JSON.stringify(permissions)) return;
        const updated = { ...user, permissions };
        storage.set(USER_KEY, JSON.stringify(updated));
        this.currentUser.set(updated);
      },
      error: () => { /* تبقى الصلاحيات المحفوظة */ }
    });
  }

  /** يُبطل التوكن في الباكاند ثم ينظّف الجلسة (حتى لو فشل الطلب) */
  logout() {
    this.api.post('/Auth/logout', {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  /** notice: رسالة تعرضها صفحة الدخول (password-changed بعد تغيير كلمة المرور) */
  clearSession(notice?: 'password-changed') {
    this.stopRenewalWatch();
    this.notifications.stop();
    this.token.set(null);
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login'], notice ? { queryParams: { notice } } : {});
  }

  getToken(): string | null {
    return this.token();
  }

  isAuthenticated(): boolean {
    const expires = Date.parse(this.currentUser()?.expiresAt ?? '');
    return !!this.token() && Number.isFinite(expires) && expires > Date.now();
  }

  hasPermission(permission: AppPermissionName): boolean {
    return this.currentUser()?.permissions?.includes(permission) ?? false;
  }

  /** تكفي واحدة من عدة صلاحيات */
  hasAnyPermission(permissions: readonly AppPermissionName[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  private loadUser(): AuthUser | null {
    const raw = storage.get(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  }
}
