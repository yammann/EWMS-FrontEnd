import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
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
  function login(role: string, permissions: string[] = []) {
    localStorage.setItem('ewms_token', 'test-only');
    TestBed.inject(AuthService).currentUser.set({ role, permissions, fullName: 'Test', email: 'test@example.test', expiresAt: new Date(Date.now() + 60000).toISOString() });
  }
  it('redirects unauthenticated direct links to login', () => {
    expect(TestBed.inject(Router).serializeUrl(run('ManageUsers') as any)).toBe('/login');
  });
  it('blocks an employee from administration and approvals', () => {
    login('Emp');
    expect(TestBed.inject(Router).serializeUrl(run('ManageUsers') as any)).toBe('/profile');
    expect(TestBed.inject(Router).serializeUrl(run('ApproveVacation') as any)).toBe('/profile');
  });
  it('allows an office manager only with the office permission', () => {
    login('Custom', ['ManageOffices']); expect(run('ManageOffices')).toBe(true);
  });
  it('matches backend approval policy', () => { login('BranchManager', ['ApproveVacation']); expect(run('ApproveVacation')).toBe(true); });
  it('rejects expired sessions', () => {
    login('SuperAdmin', ['ManageUsers']);
    TestBed.inject(AuthService).currentUser.update(u => ({ ...u!, expiresAt: '2000-01-01T00:00:00Z' }));
    expect(TestBed.inject(Router).serializeUrl(run('ManageUsers') as any)).toBe('/login');
  });
});
