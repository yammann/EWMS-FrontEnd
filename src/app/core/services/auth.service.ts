import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { LoginRequest } from '../models/login-request.model';
import { AuthResponse, AuthUser } from '../models/auth-response.model';
import { APPROVE_VACATIONS, AppPermissionName, TASK_OVERSIGHT } from '../constants/access';

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

  role = computed(() => this.currentUser()?.role ?? '');
  isSuperAdmin = computed(() => this.role().toLowerCase() === 'superadmin');
  /** يسند المهام أو يتولى مهام وحدته (صلاحيات لوحة المهام) */
  isLeader = computed(() => this.hasAnyPermission(TASK_OVERSIGHT));
  /** الموافقة الأولى أو الاعتماد النهائي — نفس فحص الباكاند في PendingForMe / Approve */
  canReviewVacations = computed(() => this.hasAnyPermission(APPROVE_VACATIONS));

  login(request: LoginRequest) {
    return this.api.post<AuthResponse>('/Auth/login', request).pipe(
      tap(response => {
        // صلاحيات توثيق الأجهزة تخص المستخدم — تُعاد قراءتها للمستخدم الجديد

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
      })
    );
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

  clearSession() {
    this.notifications.stop();
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
