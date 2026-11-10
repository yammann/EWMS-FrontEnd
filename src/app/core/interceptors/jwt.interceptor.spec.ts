import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AuthService } from '@core/services/auth.service';
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  const auth = { getToken: vi.fn(), clearSession: vi.fn() };
  let http: HttpClient, ctrl: HttpTestingController;

  beforeEach(() => {
    auth.getToken.mockReset(); auth.clearSession.mockReset();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting(), { provide: AuthService, useValue: auth }] });
    http = TestBed.inject(HttpClient); ctrl = TestBed.inject(HttpTestingController);
  });

  it('adds the bearer token to API calls only', () => {
    auth.getToken.mockReturnValue('abc');
    http.get('/api/Users/GetAll').subscribe();
    expect(ctrl.expectOne('/api/Users/GetAll').request.headers.get('Authorization')).toBe('Bearer abc');
    http.get('/maps/syria.json').subscribe();
    expect(ctrl.expectOne('/maps/syria.json').request.headers.has('Authorization')).toBe(false);
  });

  it('sends no header without a token', () => {
    auth.getToken.mockReturnValue(null);
    http.get('/api/Users/GetAll').subscribe();
    expect(ctrl.expectOne('/api/Users/GetAll').request.headers.has('Authorization')).toBe(false);
  });

  it('ends the session on 401 of a signed-in call, but not on a failed login or a 403', () => {
    auth.getToken.mockReturnValue('abc');
    http.get('/api/Users/GetAll').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/Users/GetAll').flush({}, { status: 401, statusText: 'x' });
    expect(auth.clearSession).toHaveBeenCalledTimes(1);

    http.post('/api/Auth/login', {}).subscribe({ error: () => undefined });
    ctrl.expectOne('/api/Auth/login').flush({}, { status: 401, statusText: 'x' });
    http.get('/api/Users/GetAll').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/Users/GetAll').flush({}, { status: 403, statusText: 'x' });
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
  });
});
