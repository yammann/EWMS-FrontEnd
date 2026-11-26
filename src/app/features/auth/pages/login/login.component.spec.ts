import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { LoginComponent } from './login.component';

async function open(notice: string | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(notice ? { notice } : {}) } } }
    ]
  });
  const fixture = TestBed.createComponent(LoginComponent);
  await fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  // طوابع الخلفية (ملفات SVG محلية) — ليست موضوع الاختبار
  http.match(r => r.url.startsWith('stamps/')).forEach(r => r.flush('<svg></svg>'));
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const root = fixture.nativeElement as HTMLElement;
  const button = () => root.querySelector('button[type=submit]') as HTMLButtonElement;
  const fill = (email: string, password: string) => fixture.componentInstance.form.setValue({ email, password });
  return { fixture, login: fixture.componentInstance, http, navigate, root, button, fill };
}

const response = {
  token: 'jwt', email: 'rana@ewms.test', fullName: 'رنا', role: 'Employee', branchId: 1, departmentId: 2, officeId: null,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(), permissions: ['ViewMyDashboard']
};

describe('LoginComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('does not call the server with an incomplete form, and points at the problem', async () => {
    const { fixture, login, http, root, fill } = await open();
    fill('not-an-email', '');
    login.submit();
    await fixture.whenStable();
    http.expectNone('/api/Auth/login');
    expect(root.querySelector('.form-error')?.textContent).toContain('بريداً إلكترونياً صحيحاً');
  });

  it('shows the unified busy button while checking, then signs in and goes home', async () => {
    const { fixture, login, http, navigate, button, fill } = await open();
    expect(button().textContent).toContain('متابعة');
    fill('rana@ewms.test', 'Secret#2026');
    login.submit();
    await fixture.whenStable();
    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().textContent).toContain('جارٍ التحقق…');
    expect(button().querySelector('app-action-icon')).not.toBeNull();

    const req = http.expectOne('/api/Auth/login');
    expect(req.request.body).toEqual({ Email: 'rana@ewms.test', Password: 'Secret#2026' });
    req.flush(response);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(login.loading()).toBe(false);
  });

  it('shows the server message for wrong credentials and for a locked account', async () => {
    const { fixture, login, http, navigate, root, fill } = await open();
    fill('rana@ewms.test', 'wrong');
    login.submit();
    http.expectOne('/api/Auth/login').flush({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(login.errorMessage()).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    expect(login.loading()).toBe(false);
    expect(root.textContent).toContain('غير صحيحة');

    login.submit();
    http.expectOne('/api/Auth/login').flush({ message: 'الحساب مقفل مؤقتاً حتى 10:30' }, { status: 423, statusText: 'Locked' });
    expect(login.errorMessage()).toBe('الحساب مقفل مؤقتاً حتى 10:30');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('tells the user after a password change, and clears the notice on the next attempt', async () => {
    const { login, http, root, fill } = await open('password-changed');
    expect(login.successMessage()).toContain('تم تغيير كلمة المرور');
    expect(root.textContent).toContain('تم تغيير كلمة المرور');
    fill('rana@ewms.test', 'New#2026xy');
    login.submit();
    expect(login.successMessage()).toBeNull();
    http.expectOne('/api/Auth/login').flush(response);
  });

  it('shows and hides the password', async () => {
    const { login } = await open();
    expect(login.showPassword()).toBe(false);
    login.togglePassword();
    expect(login.showPassword()).toBe(true);
  });
});
