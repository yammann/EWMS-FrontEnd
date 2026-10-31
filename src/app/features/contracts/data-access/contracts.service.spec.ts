import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { ContractsService } from './contracts.service';

describe('Contracts service', () => {
  let service: ContractsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContractsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only (the server decides what each contract allows)', () => {
    login([]);
    expect(service.access()).toMatchObject({ canView: false, canCreate: false, canViewContractors: false, canManageCriteria: false });
    login(['EvaluateContractor']);
    expect(service.access()).toMatchObject({ canView: true, canViewContractors: true, canViewCriteria: true, canCreate: false, canViewEvaluations: false });
    login(['CreateContract', 'CreateContractor', 'DeleteEvaluationCriterion', 'ViewOrganizationDashboard']);
    expect(service.access()).toMatchObject({ canView: true, canCreate: true, canCreateContractor: true, canEditContractor: false, canManageCriteria: true, canChooseBranch: true });
  });

  it('builds the search query with only the filters that are set', () => {
    service.search({ projectId: 4, status: 2, method: 2, contractorId: 9, search: ' مدرسة ', warrantyEndingOnly: true, page: 3, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/Contracts/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      projectId: '4', status: '2', method: '2', contractorId: '9', search: 'مدرسة', warrantyEndingOnly: 'true', page: '3', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 3, pageSize: 20, totalPages: 0 });
  });

  it('asks for inactive contractors and criteria only when requested and scopes them to a branch', () => {
    service.contractors(5, true).subscribe();
    http.expectOne('/api/Contractors/GetAll?branchId=5&includeInactive=true').flush([]);
    service.criteria().subscribe();
    http.expectOne('/api/EvaluationCriteria/GetAll?').flush([]);
  });

  it('sends the row version and the trimmed text with the status, award and evaluation steps', () => {
    service.changeStatus(7, 4, '  تقصير ', 'AAAA').subscribe();
    expect(http.expectOne('/api/Contracts/Status/7').request.body).toEqual({ status: 4, reason: 'تقصير', rowVersion: 'AAAA' });

    service.award(3, null, '  قرار ', 'BBBB').subscribe();
    expect(http.expectOne('/api/Contracts/Award/3').request.body).toEqual({ awardedAt: null, note: 'قرار', rowVersion: 'BBBB' });

    service.returnEvaluation(5, ' أكمل ', 'CCCC').subscribe();
    expect(http.expectOne('/api/Contracts/Evaluation/5/Return').request.body).toEqual({ note: 'أكمل', rowVersion: 'CCCC' });

    service.reviewEvaluation(5, '', 'DDDD').subscribe();
    expect(http.expectOne('/api/Contracts/Evaluation/5/Review').request.body).toEqual({ note: null, rowVersion: 'DDDD' });
  });
});
