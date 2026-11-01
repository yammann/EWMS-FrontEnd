import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { notificationRoute } from '@core/services/notification.service';
import { linkRoute } from '@features/task-board';
import { PricingService } from './pricing.service';

describe('Pricing service', () => {
  let service: PricingService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PricingService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only', () => {
    login([]);
    expect(service.access()).toMatchObject({ canView: false, canViewAgreements: false, canRegister: false, canApprove: false });
    login(['PreparePricingOffers']);
    expect(service.access()).toMatchObject({ canView: true, canPrepareOffers: true, canAssign: false, canViewAgreements: false });
    login(['ApprovePricingAgreement', 'PreparePricingAgreement']);
    expect(service.access()).toMatchObject({ canView: false, canViewAgreements: true, canApproveAgreement: true, canPrepareAgreement: true });
  });

  it('derives the reference price buttons from their own permissions', () => {
    login(['ViewReferencePrices']);
    expect(service.access()).toMatchObject({ canViewReferencePrices: true, canAddReferencePrice: false, canApproveReferencePrice: false, canView: false });
    login(['AddReferencePrice', 'ApproveReferencePrice']);
    expect(service.access()).toMatchObject({ canViewReferencePrices: true, canAddReferencePrice: true, canApproveReferencePrice: true });
  });

  it('builds the reference price query with only the filters that are set and trims the approval note', () => {
    service.searchReferencePrices({ branchId: null, search: ' سلك ', supplierId: 3, projectId: null, status: 2, includeSuperseded: true, from: '2026-01-01', to: '', page: 1, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/ReferencePrices/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      search: 'سلك', supplierId: '3', status: '2', includeSuperseded: 'true', from: '2026-01-01', page: '1', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });

    service.approveReferencePrice(7, '  معتمد  ', 'AAAA').subscribe();
    expect(http.expectOne('/api/ReferencePrices/Approve/7').request.body).toEqual({ note: 'معتمد', rowVersion: 'AAAA' });
    service.approveReferencePrice(7, '', 'BBBB').subscribe();
    expect(http.expectOne('/api/ReferencePrices/Approve/7').request.body).toEqual({ note: null, rowVersion: 'BBBB' });
  });

  it('opens the reference price import only with its own permission', () => {
    login(['AddReferencePrice']);
    expect(service.access()).toMatchObject({ canAddReferencePrice: true, canImportReferencePrices: false });
    login(['ImportReferencePrices']);
    expect(service.access()).toMatchObject({ canViewReferencePrices: true, canImportReferencePrices: true, canAddReferencePrice: false });
  });

  it('uploads the import file as a form field with the dry run flag and the optional branch', () => {
    const file = new File(['x'], 'prices.xlsx');
    service.importReferencePrices(file, true).subscribe();
    const preview = http.expectOne('/api/ReferencePrices/Import?dryRun=true');
    expect((preview.request.body as FormData).get('file')).toBeInstanceOf(File);
    preview.flush({});

    service.importReferencePrices(file, false, 5).subscribe();
    http.expectOne('/api/ReferencePrices/Import?dryRun=false&branchId=5').flush({});

    service.referencePriceTemplate().subscribe();
    http.expectOne('/api/ReferencePrices/ImportTemplate').flush(new Blob());
  });

  it('derives the reconciliation buttons from their own permissions', () => {
    login(['ViewPriceReconciliations']);
    expect(service.access()).toMatchObject({ canViewReconciliations: true, canPrepareReconciliation: false, canApproveReconciliation: false });
    login(['ApprovePriceReconciliation']);
    expect(service.access()).toMatchObject({ canViewReconciliations: true, canApproveReconciliation: true, canPrepareReconciliation: false });
  });

  it('talks to the reconciliation endpoints with trimmed text and the row version', () => {
    service.searchReconciliations({ branchId: null, status: 4, supplierId: 3, projectId: null, search: ' F-1 ', page: 1, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/PriceReconciliations/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({ status: '4', supplierId: '3', search: 'F-1', page: '1', pageSize: '20' });
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });

    service.reconciliationCandidates(7, ' سلك ', 2).subscribe();
    http.expectOne('/api/PriceReconciliations/Candidates?supplierId=7&search=%D8%B3%D9%84%D9%83&branchId=2').flush([]);

    service.recordReconciliation(5, 4, ' فرق ', 'AAAA').subscribe();
    expect(http.expectOne('/api/PriceReconciliations/Record/5').request.body).toEqual({ result: 4, note: 'فرق', rowVersion: 'AAAA' });
    service.decideReconciliation(5, false, ' أكملوا ', 'BBBB').subscribe();
    expect(http.expectOne('/api/PriceReconciliations/Decide/5').request.body).toEqual({ approve: false, note: 'أكملوا', rowVersion: 'BBBB' });
    service.referReconciliation(5, ' المالية ', '', 'CCCC').subscribe();
    expect(http.expectOne('/api/PriceReconciliations/Refer/5').request.body).toEqual({ recipient: 'المالية', note: null, rowVersion: 'CCCC' });
  });

  it('routes the reconciliation notification to its page', () => {
    const n = { relatedEntityType: 'PriceReconciliation', relatedEntityId: 9, type: 'x' } as Parameters<typeof notificationRoute>[0];
    expect(notificationRoute(n, false)).toBe('/pricing/reconciliations/9');
  });

  it('builds the search query with only the filters that are set', () => {
    service.search({ branchId: null, projectId: 4, status: 2, search: ' أسلاك ', overdueOnly: true, mine: false, page: 2, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/PricingRequests/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      projectId: '4', status: '2', search: 'أسلاك', overdueOnly: 'true', page: '2', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 20, totalPages: 0 });
  });

  it('sends the trimmed reason with a selection and the row version with each step', () => {
    service.select(9, ' مطابق وأنسب ').subscribe();
    expect(http.expectOne('/api/PricingRequests/Select/9').request.body).toEqual({ reason: 'مطابق وأنسب' });

    service.recommend(3, ' نوصي ', 'AAAA').subscribe();
    expect(http.expectOne('/api/PricingRequests/Recommend/3').request.body).toEqual({ note: 'نوصي', rowVersion: 'AAAA' });

    service.decide(3, 3, ' ناقص ', 'BBBB').subscribe();
    expect(http.expectOne('/api/PricingRequests/Decide/3').request.body).toEqual({ decision: 3, note: 'ناقص', rowVersion: 'BBBB' });

    service.decide(3, 1, '', 'CCCC').subscribe();
    expect(http.expectOne('/api/PricingRequests/Decide/3').request.body).toEqual({ decision: 1, note: null, rowVersion: 'CCCC' });

    service.sendResult(3, ' مكتب العقود ', '', 'DDDD').subscribe();
    expect(http.expectOne('/api/PricingRequests/SendResult/3').request.body).toEqual({ recipient: 'مكتب العقود', note: null, rowVersion: 'DDDD' });
  });

  it('asks for the assignees of the request branch', () => {
    service.assignees(7).subscribe();
    http.expectOne('/api/PricingRequests/Assignees?branchId=7').flush([]);
    service.assignees().subscribe();
    http.expectOne('/api/PricingRequests/Assignees').flush([]);
  });

  it('reviews an agreement with approve flag, note and row version', () => {
    service.reviewAgreement(5, false, ' أضف المواصفات ', 'EEEE').subscribe();
    expect(http.expectOne('/api/PricingAgreements/Review/5').request.body).toEqual({ approve: false, note: 'أضف المواصفات', rowVersion: 'EEEE' });
  });

  it('routes notifications and task links to the pricing pages', () => {
    const n = (relatedEntityType: string) => ({ relatedEntityType, relatedEntityId: 12, type: 'x' }) as Parameters<typeof notificationRoute>[0];
    expect(notificationRoute(n('PricingRequest'), false)).toBe('/pricing/12');
    expect(notificationRoute(n('PricingAgreement'), false)).toBe('/pricing/agreements/12');
    expect(notificationRoute(n('ReferencePrice'), false)).toBe('/pricing/reference-prices/12');
    expect(linkRoute('PricingRequest', 12, false)).toBe('/pricing/12');
    expect(linkRoute('PricingAgreement', 12, false)).toBe('/pricing/agreements/12');
  });
});
