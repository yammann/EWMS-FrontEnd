import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/models/ewms.models';
import { ToastService } from '@shared/ui/toast.service';
import { InkStroke, inkOnScreen, luminance, strokePath, strokesToPng } from './utils/signature-ink';
import { PasswordDialog } from './components/password-dialog';
import { SignaturePanel } from './components/signature-panel';
import { ProfilePage } from './pages/profile-page/profile-page';

const providers = [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(), provideRouter([])];
const signIn = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
  email: 'rana@ewms.test', fullName: 'رنا', role: 'Employee', branchId: 1, departmentId: 2, officeId: null,
  expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions
});

describe('signature ink geometry', () => {
  /** أبعد مسافة رأسية لحدود خط أفقي عن محوره = نصف عرضه الأقصى */
  const halfWidth = (path: string, axisY: number) => {
    const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    let max = 0;
    for (let i = 1; i < nums.length; i += 2) max = Math.max(max, Math.abs(nums[i] - axisY));
    return max;
  };
  const line = (p: number): InkStroke => ({ color: '#000', size: 6, points: Array.from({ length: 30 }, (_, i) => ({ x: i * 4, y: 50, p })) });

  it('draws a single tap as a closed dot whose size follows the pressure', () => {
    const soft = strokePath({ color: '#000', size: 10, points: [{ x: 20, y: 20, p: 0 }] });
    const hard = strokePath({ color: '#000', size: 10, points: [{ x: 20, y: 20, p: 1 }] });
    expect(soft).toMatch(/^M .* a .* Z$/);
    expect(soft).toContain(' a 2 2 ');                          // 5 × (0.4 + 0.6 × 0)
    expect(hard).toContain(' a 5 5 ');                          // 5 × (0.4 + 0.6 × 1)
  });

  it('draws a stroke as one closed outline, wider under more pressure', () => {
    const light = strokePath(line(0.1)), heavy = strokePath(line(1));
    for (const path of [light, heavy]) {
      expect(path.startsWith('M ')).toBe(true);
      expect(path.endsWith(' Z')).toBe(true);
      expect(path).toContain(' Q ');
      expect(path).not.toMatch(/NaN|Infinity/);
    }
    expect(halfWidth(heavy, 50)).toBeGreaterThan(halfWidth(light, 50) * 2);
    expect(halfWidth(heavy, 50)).toBeLessThanOrEqual(3);        // لا يتجاوز نصف عرض الريشة
  });

  it('exports nothing for an empty pad, and keeps the ink colour on light surfaces', () => {
    expect(strokesToPng([])).toBeNull();
    expect(inkOnScreen('#123456', false)).toBe('#123456');
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(luminance([0, 0, 0])).toBe(0);
  });
});

describe('PasswordDialog', () => {
  const open = () => {
    TestBed.configureTestingModule({ providers });
    signIn([]);
    const fixture = TestBed.createComponent(PasswordDialog);
    fixture.componentRef.setInput('email', 'rana@ewms.test');
    return { dialog: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  };
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('submits only with the current password and a matching new one', () => {
    const { dialog } = open();
    expect(dialog.canSubmit()).toBe(false);
    dialog.current.set('Old#2026x'); dialog.next.set('New#2026xy'); dialog.repeat.set('New#2026xz');
    expect(dialog.canSubmit()).toBe(false);
    dialog.repeat.set('New#2026xy');
    expect(dialog.canSubmit()).toBe(true);
  });

  it('refuses a weak password or the same password before asking the server', () => {
    const { dialog, http } = open();
    dialog.current.set('Old#2026x'); dialog.next.set('abc'); dialog.repeat.set('abc');
    dialog.submit();
    expect(dialog.error()).toContain('أحرف على الأقل');
    dialog.next.set('Old#2026x'); dialog.repeat.set('Old#2026x');
    dialog.submit();
    expect(dialog.error()).toBe('كلمة المرور الجديدة يجب أن تختلف عن الحالية');
    http.expectNone('/api/Auth/Password');
  });

  it('changes the password, then ends the session with the «changed» notice', () => {
    const { dialog, http } = open();
    const clear = vi.spyOn(TestBed.inject(AuthService), 'clearSession').mockImplementation(() => undefined);
    dialog.current.set('Old#2026x'); dialog.next.set('New#2026xy'); dialog.repeat.set('New#2026xy');
    dialog.submit();
    const req = http.expectOne('/api/Auth/Password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ currentPassword: 'Old#2026x', newPassword: 'New#2026xy' });
    req.flush({ message: 'تم' });
    expect(clear).toHaveBeenCalledWith('password-changed');
  });

  it('shows the server message when the current password is wrong', () => {
    const { dialog, http } = open();
    dialog.current.set('Wrong#2026'); dialog.next.set('New#2026xy'); dialog.repeat.set('New#2026xy');
    dialog.submit();
    http.expectOne('/api/Auth/Password').flush({ message: 'كلمة المرور الحالية غير صحيحة' }, { status: 400, statusText: 'Bad Request' });
    expect(dialog.error()).toBe('كلمة المرور الحالية غير صحيحة');
    expect(dialog.saving()).toBe(false);
  });
});

describe('SignaturePanel', () => {
  const open = () => {
    TestBed.configureTestingModule({ providers });
    const panel = TestBed.createComponent(SignaturePanel).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    return { panel, http };
  };
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows the current signature, and saves a new one with the password', () => {
    const { panel, http } = open();
    expect(panel.loading()).toBe(true);
    http.expectOne('/api/Auth/Signature').flush({ image: 'data:image/png;base64,AAA' });
    expect(panel.loading()).toBe(false);
    expect(panel.current()).toBe('data:image/png;base64,AAA');

    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    panel.open();
    panel.save({ image: 'data:image/png;base64,BBB', password: 'Secret#1' });
    const req = http.expectOne('/api/Auth/Signature');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ image: 'data:image/png;base64,BBB', password: 'Secret#1' });
    req.flush({ message: 'تم حفظ التوقيع' });
    expect(panel.current()).toBe('data:image/png;base64,BBB');
    expect(panel.padOpen()).toBe(false);
    expect(success).toHaveBeenCalledWith('اعتُمد توقيعك الجديد');
  });

  it('removes the signature only with a password', () => {
    const { panel, http } = open();
    http.expectOne('/api/Auth/Signature').flush({ image: 'data:image/png;base64,AAA' });
    panel.remove();
    http.expectNone(r => r.method === 'PUT');
    panel.password.set('Secret#1');
    panel.remove();
    const req = http.expectOne('/api/Auth/Signature');
    expect(req.request.body).toEqual({ image: null, password: 'Secret#1' });
    req.flush({ message: 'تم حذف التوقيع' });
    expect(panel.current()).toBeNull();
    expect(panel.password()).toBe('');
  });
});

describe('ProfilePage', () => {
  const me: User = {
    id: 5, fullName: 'رنا', email: 'rana@ewms.test', personalIdNumber: null, phoneNumber: '0933123456', roleId: 2, roleName: 'موظف',
    branchId: 1, branchName: 'دمشق', departmentId: 2, departmentName: 'العمليات', officeId: null, officeName: '',
    isActive: true, createdAt: '2026-01-10T08:00:00'
  };

  it('loads my job details, and offers the signature and vacations only with their permissions', async () => {
    TestBed.configureTestingModule({ providers });
    signIn(['ViewVacations']);
    const fixture = TestBed.createComponent(ProfilePage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/Auth/Me').flush(me);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    expect(page.profile()?.departmentName).toBe('العمليات');
    expect(page.canSign()).toBe(false);
    expect(page.canVacations()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('الرقم الذاتي غير مسجّل');
    expect(root.querySelector('app-signature-panel')).toBeNull();
    http.verify();
  });

  it('shows the load error with a retry', async () => {
    TestBed.configureTestingModule({ providers });
    signIn([]);
    const fixture = TestBed.createComponent(ProfilePage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/Auth/Me').flush({ message: 'انتهت الجلسة' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(fixture.componentInstance.profileError()).toBe('انتهت الجلسة');
    (fixture.nativeElement.querySelector('.alert-error button') as HTMLButtonElement).click();
    http.expectOne('/api/Auth/Me').flush(me);
    expect(fixture.componentInstance.profileError()).toBe('');
    http.verify();
  });
});
