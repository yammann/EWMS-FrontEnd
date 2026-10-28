import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '@core/services/auth.service';

/** تجديد الجلسة في AuthService: يجدّد المستخدم النشط عند اقتراب الانتهاء، ولا يطلب شيئاً حين يتسع الوقت */
describe('AuthService session renewal', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  const response = (token: string, minutesLeft: number) => ({
    token, expiresAt: new Date(Date.now() + minutesLeft * 60_000).toISOString(), fullName: 'م', email: 'a@x.sy', role: 'R',
    branchId: 1, departmentId: 1, officeId: null, permissions: ['ViewVacations']
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    auth.clearSession();   // يوقف المؤقت
    http.verify();
  });

  it('renews right away when the token is close to its end and the user is active', () => {
    auth.login({ Email: 'a@x.sy', Password: 'x' }).subscribe();
    http.expectOne('/api/Auth/login').flush(response('first', 10));

    const renew = http.expectOne('/api/Auth/Renew');
    expect(renew.request.method).toBe('POST');
    renew.flush(response('second', 120));

    expect(auth.getToken()).toBe('second');
    expect(auth.hasPermission('ViewVacations')).toBe(true);
    expect(Date.parse(auth.currentUser()!.expiresAt)).toBeGreaterThan(Date.now() + 100 * 60_000);
  });

  it('does not ask for a renewal while there is plenty of time left', () => {
    auth.login({ Email: 'a@x.sy', Password: 'x' }).subscribe();
    http.expectOne('/api/Auth/login').flush(response('first', 100));

    http.expectNone('/api/Auth/Renew');
    expect(auth.getToken()).toBe('first');
  });

  it('keeps the current token when a renewal request fails for a transient reason', () => {
    auth.login({ Email: 'a@x.sy', Password: 'x' }).subscribe();
    http.expectOne('/api/Auth/login').flush(response('first', 10));

    http.expectOne('/api/Auth/Renew').flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });

    expect(auth.getToken()).toBe('first');
  });
});
