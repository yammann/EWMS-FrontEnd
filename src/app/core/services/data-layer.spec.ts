import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { toApiError } from '@core/http/api-error';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';

describe('toApiError', () => {
  const err = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });
  it('maps connection loss, forbidden and bad login to Arabic messages', () => {
    expect(toApiError(err(0)).message).toBe('لا يمكن الاتصال بالخادم');
    expect(toApiError(err(403)).message).toBe('ليس لديك صلاحية للوصول');
    expect(toApiError(err(401)).message).toBe('بيانات الدخول غير صحيحة');
  });
  it('keeps the backend business message as is', () => {
    expect(toApiError(err(400, { message: 'الاسم مستخدم' })).message).toBe('الاسم مستخدم');
  });
  it('joins validation errors (array and dictionary shapes)', () => {
    expect(toApiError(err(400, { errors: [{ message: 'أ' }, { message: 'ب' }] })).message).toBe('أ، ب');
    expect(toApiError(err(400, { errors: { Name: ['مطلوب'], Description: ['مطلوب أيضاً'] } })).message).toBe('مطلوب، مطلوب أيضاً');
  });
});

describe('apiErrorInterceptor', () => {
  let api: ApiService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('turns /api failures into { status, message }', () => {
    let caught: unknown;
    api.get('/X').subscribe({ error: e => caught = e });
    http.expectOne('/api/X').flush({ message: 'فشل' }, { status: 404, statusText: 'Not Found' });
    expect(caught).toEqual({ status: 404, message: 'فشل' });
  });
});

describe('LookupsService', () => {
  let lookups: LookupsService; let http: HttpTestingController; let permissions: string[];
  beforeEach(() => {
    permissions = ['ViewBranches'];
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { hasPermission: (p: string) => permissions.includes(p) } }]
    });
    lookups = TestBed.inject(LookupsService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('fetches once and reuses the cache until invalidated or forced', () => {
    const seen: unknown[] = [];
    lookups.branches().subscribe(b => seen.push(b));
    http.expectOne('/api/Branches/GetAll').flush([{ id: 1, name: 'أ', description: '' }]);
    lookups.branches().subscribe(b => seen.push(b));      // من التخزين: بلا طلب
    http.expectNone('/api/Branches/GetAll');
    expect(seen.length).toBe(2);

    lookups.invalidate('branches');
    lookups.branches().subscribe();
    http.expectOne('/api/Branches/GetAll').flush([]);

    lookups.branches(true).subscribe();                   // force يتجاوز التخزين
    http.expectOne('/api/Branches/GetAll').flush([]);
  });

  it('does not cache a failed request', () => {
    lookups.roles().subscribe({ error: () => {} });
    http.expectOne('/api/Roles/GetAll').flush('x', { status: 500, statusText: 'Err' });
    lookups.roles().subscribe();
    http.expectOne('/api/Roles/GetAll').flush([]);
  });

  it('derives branch options from departments when the user cannot view branches', () => {
    permissions = [];
    let result: { id: number; name: string }[] = [];
    lookups.branchOptions().subscribe(b => result = b);
    http.expectOne('/api/Department/GetAll').flush([
      { id: 1, name: 'ق1', branchId: 5, branchName: 'فرع5' }, { id: 2, name: 'ق2', branchId: 5, branchName: 'فرع5' }, { id: 3, name: 'ق3', branchId: 6, branchName: 'فرع6' }
    ]);
    expect(result.map(b => b.id)).toEqual([5, 6]);
  });
});
