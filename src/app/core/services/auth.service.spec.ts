import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthResponse } from '@core/models/auth-response.model';
import { AuthService } from './auth.service';

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const response = (over: Partial<AuthResponse> = {}): AuthResponse => ({
  token: 'jwt-token', expiresAt: future(), fullName: 'مستخدم اختبار', email: 'u@example.test', role: 'دور',
  branchId: 1, departmentId: 2, officeId: null, permissions: ['ViewUsers'], ...over
});

describe('AuthService', () => {
  let values: Map<string, string>;

  function setup(stored: Record<string, string> = {}) {
    values = new Map(Object.entries(stored));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k), clear: () => values.clear()
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('stores the token and user on login and exposes the permissions', () => {
    const { auth, http } = setup();
    auth.login({ email: 'u@example.test', password: 'x' } as never).subscribe();
    http.expectOne('/api/Auth/login').flush(response());
    expect(auth.getToken()).toBe('jwt-token');
    expect(values.get('ewms_token')).toBe('jwt-token');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.hasPermission('ViewUsers')).toBe(true);
    expect(auth.hasPermission('DeleteUser')).toBe(false);
    expect(auth.hasAnyPermission(['DeleteUser', 'ViewUsers'])).toBe(true);
  });

  it('is not authenticated with an expired session or without a token', () => {
    const expired = JSON.stringify({ ...response(), expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(setup({ ewms_token: 't', ewms_user: expired }).auth.isAuthenticated()).toBe(false);
    expect(setup({ ewms_user: JSON.stringify(response()) }).auth.isAuthenticated()).toBe(false);
  });

  it('survives a corrupted stored user and a blocked storage', () => {
    expect(setup({ ewms_token: 't', ewms_user: '{not json' }).auth.currentUser()).toBeNull();
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.login({} as never).subscribe();
    http.expectOne('/api/Auth/login').flush(response());
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears the session on logout even when the request fails, and goes to the login page', () => {
    const { auth, http, router } = setup({ ewms_token: 't', ewms_user: JSON.stringify(response()) });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.logout();
    http.expectOne('/api/Auth/logout').flush({}, { status: 500, statusText: 'x' });
    expect(auth.getToken()).toBeNull();
    expect(values.has('ewms_token')).toBe(false);
    expect(auth.currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {});
  });

  it('carries a notice to the login page after a password change', () => {
    const { auth, router } = setup({ ewms_token: 't', ewms_user: JSON.stringify(response()) });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.clearSession('password-changed');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { notice: 'password-changed' } });
  });

  it('refreshes the permissions from the server without logging in again, and keeps the old ones on failure', () => {
    const { auth, http } = setup({ ewms_token: 't', ewms_user: JSON.stringify(response()) });
    auth.refreshPermissions();
    http.expectOne('/api/Auth/Permissions').flush({ permissions: ['ViewUsers', 'EditUser'] });
    expect(auth.hasPermission('EditUser')).toBe(true);
    expect(JSON.parse(values.get('ewms_user')!).permissions).toContain('EditUser');

    auth.refreshPermissions();
    http.expectOne('/api/Auth/Permissions').flush({}, { status: 500, statusText: 'x' });
    expect(auth.hasPermission('EditUser')).toBe(true);
  });
});
