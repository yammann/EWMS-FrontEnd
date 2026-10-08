import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VacationService } from './vacation.service';
import { ApiService } from '@core/services/api.service';

describe('Vacation API contract', () => {
  let service: VacationService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(VacationService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('submits multipart dates without a caller-supplied employee ID', () => {
    service.create({ vacationTypeId: 2, startVac: '2026-10-01', endVac: '2026-10-02', vacReason: ' سبب ' }).subscribe();
    const req = http.expectOne('/api/Vacations/Create');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('VacationTypeId')).toBe('2');
    expect(body.get('StartVac')).toBe('2026-10-01');
    expect(body.get('EndVac')).toBe('2026-10-02');
    expect(body.get('VacReason')).toBe('سبب');
    expect(body.has('UserId')).toBe(false);
    req.flush({});
  });
  it('sends approval as JSON', () => {
    service.approve(9, false, 'رفض').subscribe();
    const req = http.expectOne('/api/Vacations/Approve/9');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ approve: false, reason: 'رفض' });
    req.flush({ message: 'تم' });
  });
  it('cancels through PUT on the owner route', () => {
    service.cancel(5).subscribe();
    const req = http.expectOne('/api/Vacations/Cancel/5');
    expect(req.request.method).toBe('PUT');
    req.flush({ message: 'تم' });
  });
  it('reads the current employee route', () => {
    service.mine().subscribe(); http.expectOne('/api/Vacations/My').flush([]);
  });
  it('shows FluentValidation messages rather than generic errors', () => {
    let message = '';
    TestBed.inject(ApiService).post('/test', {}).subscribe({ error: e => message = e.message });
    http.expectOne('/api/test').flush({ message: 'خطأ', errors: [{ property: 'EndVac', message: 'تاريخ غير صحيح' }] }, { status: 400, statusText: 'Bad Request' });
    expect(message).toBe('تاريخ غير صحيح');
  });
});
