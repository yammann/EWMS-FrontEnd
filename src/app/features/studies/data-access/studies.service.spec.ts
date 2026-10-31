import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { StudiesService } from './studies.service';

describe('Studies service', () => {
  let service: StudiesService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StudiesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only (the server decides what each study allows)', () => {
    login([]);
    expect(service.access()).toMatchObject({ canView: false, canCreate: false, canPrepare: false, canReview: false, canManageTypes: false });
    login(['PrepareStudyDeliverable']);
    expect(service.access()).toMatchObject({ canView: true, canPrepare: true, canReview: false });
    login(['CreateStudyOrder', 'RecordStudySubmission', 'CreateDeliverableType', 'ViewOrganizationDashboard']);
    expect(service.access()).toMatchObject({ canView: true, canCreate: true, canSend: true, canManageTypes: true, canCreateType: true, canEditType: false, canChooseBranch: true });
  });

  it('builds the search query with only the filters that are set', () => {
    service.search({ projectId: 4, status: 2, search: ' مدرسة ', overdueOnly: true, mine: true, page: 3, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/Studies/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      projectId: '4', status: '2', search: 'مدرسة', overdueOnly: 'true', mine: 'true', page: '3', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 3, pageSize: 20, totalPages: 0 });
  });

  it('asks for inactive types only when requested and scopes them to a branch', () => {
    service.types(5, true).subscribe();
    http.expectOne('/api/DeliverableTypes/GetAll?branchId=5&includeInactive=true').flush([]);
    service.types().subscribe();
    http.expectOne('/api/DeliverableTypes/GetAll?').flush([]);
  });

  it('sends the row version the user saw with every operation on a deliverable', () => {
    service.submitDeliverable(9, 'AAAA').subscribe();
    expect(http.expectOne('/api/Studies/Deliverable/9/Submit').request.body).toEqual({ rowVersion: 'AAAA' });

    service.review(9, false, '  عدّل المقياس ', 'BBBB').subscribe();
    expect(http.expectOne('/api/Studies/Deliverable/9/Review').request.body).toEqual({ approve: false, note: 'عدّل المقياس', rowVersion: 'BBBB' });

    service.review(9, true, '', 'CCCC').subscribe();
    expect(http.expectOne('/api/Studies/Deliverable/9/Review').request.body).toEqual({ approve: true, note: null, rowVersion: 'CCCC' });

    service.sendBack(9, ' سبب ', 'DDDD').subscribe();
    expect(http.expectOne('/api/Studies/Deliverable/9/SendBack').request.body).toEqual({ note: 'سبب', rowVersion: 'DDDD' });

    service.attachDocument(9, 31, 'EEEE').subscribe();
    const attach = http.expectOne('/api/Studies/Deliverable/9/Document');
    expect(attach.request.method).toBe('PUT');
    expect(attach.request.body).toEqual({ documentId: 31, rowVersion: 'EEEE' });
  });

  it('records the center submission and its decision by hand', () => {
    service.send(7, '  أُرسلت باليد ', 'AAAA').subscribe();
    expect(http.expectOne('/api/Studies/Send/7').request.body).toEqual({ note: 'أُرسلت باليد', outgoingCorrespondenceId: null, rowVersion: 'AAAA' });

    service.decide(12, 3, ' راجعوا الكميات ', 'BBBB').subscribe();
    expect(http.expectOne('/api/Studies/Decide/12').request.body).toEqual({ decision: 3, note: 'راجعوا الكميات', decisionVersionId: null, rowVersion: 'BBBB' });
  });
});
