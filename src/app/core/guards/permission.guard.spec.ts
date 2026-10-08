import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { permissionGuard } from './permission.guard';
import { provideHttpClient } from '@angular/common/http';
import { vi } from 'vitest';

describe('Permission guard', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear()
    });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });
  afterEach(() => vi.unstubAllGlobals());
  function run(permission?: string) {
    return TestBed.runInInjectionContext(() => permissionGuard({ data: permission ? { permission } : {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }
  function runAny(anyPermission: string[]) {
    return TestBed.runInInjectionContext(() => permissionGuard({ data: { anyPermission } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }
  function login(role: string, permissions: string[] = []) {
    localStorage.setItem('ewms_token', 'test-only');
    TestBed.inject(AuthService).currentUser.set({
      role, permissions, fullName: 'Test', email: 'test@example.test',
      branchId: 1, departmentId: 2, officeId: 3,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  }
  const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as any);

  it('redirects unauthenticated direct links to login', () => {
    expect(url(run('ViewUsers'))).toBe('/login');
  });
  it('blocks a role without the permission, whatever its name', () => {
    login('رئيس قسم العمليات');
    expect(url(run('ViewUsers'))).toBe('/profile');
    expect(url(runAny(['ApproveVacationFirst', 'ApproveVacationFinal']))).toBe('/profile');
  });
  it('allows any role that holds the permission (Role-Permission only)', () => {
    login('موظف', ['ViewOffices']); expect(run('ViewOffices')).toBe(true);
  });
  it('vacation review needs either approval stage', () => {
    login('إداري الفرع', ['ApproveVacationFinal']);
    expect(runAny(['ApproveVacationFirst', 'ApproveVacationFinal'])).toBe(true);
  });
  it('a route without a declared permission is never open by default', () => {
    login('SuperAdmin', ['ViewUsers']);
    expect(url(run())).toBe('/profile');
  });
  it('rejects expired sessions', () => {
    login('SuperAdmin', ['ViewUsers']);
    TestBed.inject(AuthService).currentUser.update(u => ({ ...u!, expiresAt: '2000-01-01T00:00:00Z' }));
    expect(url(run('ViewUsers'))).toBe('/login');
  });
});
