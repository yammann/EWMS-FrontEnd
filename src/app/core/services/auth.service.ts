import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { DeviceService } from './device.service';
import { LoginRequest } from '../models/login-request.model';
import { AuthResponse, AuthUser } from '../models/auth-response.model';

const TOKEN_KEY = 'ewms_token';
const USER_KEY = 'ewms_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private notifications = inject(NotificationService);
  private devices = inject(DeviceService);

  currentUser = signal<AuthUser | null>(this.loadUser());

  login(request: LoginRequest) {
    return this.api.post<AuthResponse>('/Auth/login', request).pipe(
      tap(response => {
        // صلاحيات توثيق الأجهزة تخص المستخدم — تُعاد قراءتها للمستخدم الجديد
        this.devices.resetAccess();
        if (response.token) {
          localStorage.setItem(TOKEN_KEY, response.token);
        }

        const user: AuthUser = {
          email: response.email,
          fullName: response.fullName,
          role: response.role,
          expiresAt: response.expiresAt,
          permissions: response.permissions ?? []
        };

        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      })
    );
  }

  logout() {
    this.api.post('/Auth/logout', {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  clearSession() {
    this.notifications.stop();
    this.devices.resetAccess();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const expires = Date.parse(this.currentUser()?.expiresAt ?? '');
    return !!this.getToken() && Number.isFinite(expires) && expires > Date.now();
  }

  // نفس سياسة الباكاند على PendingForMe / Approve
  canReviewVacations(): boolean {
    return this.hasPermission('ApproveVacation');
  }

  /* =====================================================
   * التحقق من الصلاحيات
   * ===================================================== */
  hasPermission(permissionName: string): boolean {
    const user = this.currentUser();
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionName);
  }

  hasAnyPermission(...permissionNames: string[]): boolean {
    return permissionNames.some(name => this.hasPermission(name));
  }

  hasAllPermissions(...permissionNames: string[]): boolean {
    return permissionNames.every(name => this.hasPermission(name));
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}
