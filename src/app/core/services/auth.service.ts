import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { DeviceService } from './device.service';
import { LoginRequest } from '../models/login-request.model';
import { AuthResponse, AuthUser } from '../models/auth-response.model';
import { AppPermission, AppPermissionName, AppRole, LEADER_ROLES } from '../constants/access';

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
  private devices = inject(DeviceService);

  /** التوكن في الذاكرة أيضاً — لا نقرأ التخزين مع كل طلب */
  private token = signal<string | null>(storage.get(TOKEN_KEY));

  currentUser = signal<AuthUser | null>(this.loadUser());

  role = computed(() => this.currentUser()?.role ?? '');
  isSuperAdmin = computed(() => this.role() === AppRole.SuperAdmin);
  /** رئيس فرع/قسم/مكتب أو مدير النظام */
  isLeader = computed(() => LEADER_ROLES.includes(this.role()));
  /** نفس سياسة الباكاند على PendingForMe / Approve */
  canReviewVacations = computed(() => this.hasPermission(AppPermission.ApproveVacation));

  login(request: LoginRequest) {
    return this.api.post<AuthResponse>('/Auth/login', request).pipe(
      tap(response => {
        // صلاحيات توثيق الأجهزة تخص المستخدم — تُعاد قراءتها للمستخدم الجديد
        this.devices.resetAccess();

        const user: AuthUser = {
          email: response.email,
          fullName: response.fullName,
          role: response.role,
          roleName: response.roleName,
          expiresAt: response.expiresAt,
          permissions: response.permissions ?? [],
          permissionScopes: response.permissionScopes ?? {}
        };

        this.token.set(response.token);
        storage.set(TOKEN_KEY, response.token);
        storage.set(USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      })
    );
  }

  /**
   * يحدّث قائمة الصلاحيات من الخادم (عند فتح التطبيق): تتغيّر بتعديل الدور أو إسناد الخدمات أو نقل الموظف،
   * فلا يحتاج المستخدم لإعادة تسجيل الدخول — يكفي تحديث الصفحة. الفشل يُهمل (تبقى القائمة المحفوظة).
   */
  refreshPermissions() {
    if (!this.isAuthenticated()) return;
    this.api.get<{ permissions: string[]; scopes: Record<string, number> }>('/Auth/Permissions').subscribe({
      next: ({ permissions, scopes }) => {
        const user = this.currentUser();
        if (!user || (JSON.stringify(user.permissions) === JSON.stringify(permissions)
          && JSON.stringify(user.permissionScopes ?? {}) === JSON.stringify(scopes))) return;
        const updated = { ...user, permissions, permissionScopes: scopes };
        storage.set(USER_KEY, JSON.stringify(updated));
        this.currentUser.set(updated);
        this.devices.resetAccess();
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

  clearSession() {
    this.notifications.stop();
    this.devices.resetAccess();
    this.token.set(null);
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
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

  /**
   * نطاق الصلاحية للمستخدم: 0 لا يملكها، 1 سجلاته، 2 مكتبه، 3 قسمه، 4 فرعه، 5 كل المؤسسة.
   * للعرض فقط (إظهار رابط أو تبويب) — الباكاند يحدد السجلات فعلياً.
   */
  scopeOf(permission: AppPermissionName): number {
    if (!this.hasPermission(permission)) return 0;
    return this.currentUser()?.permissionScopes?.[permission] ?? 1;
  }

  /** تكفي واحدة من عدة صلاحيات */
  hasAnyPermission(permissions: readonly AppPermissionName[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  hasRole(...roles: readonly string[]): boolean {
    return roles.includes(this.role());
  }

  private loadUser(): AuthUser | null {
    const raw = storage.get(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  }
}
