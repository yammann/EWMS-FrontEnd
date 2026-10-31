import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { HandoverService } from './handover.service';

describe('Handover service', () => {
  let service: HandoverService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HandoverService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only', () => {
    login([]);
    expect(service.access()).toMatchObject({ canView: false, canRequest: false, canManage: false, canFollowNotes: false });
    login(['FollowHandoverNotes']);
    expect(service.access()).toMatchObject({ canView: true, canFollowNotes: true, canManage: false });
    login(['RequestHandover', 'ManageHandover']);
    expect(service.access()).toMatchObject({ canView: true, canRequest: true, canManage: true, canFollowNotes: false });
  });

  it('builds the search query with only the filters that are set', () => {
    service.search({ projectId: 4, kind: 2, status: 3, search: ' مدرسة ', openNotesOnly: true, page: 2, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/Handovers/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      projectId: '4', kind: '2', status: '3', search: 'مدرسة', openNotesOnly: 'true', page: '2', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 20, totalPages: 0 });
  });

  it('sends the row version and the trimmed text with each note step', () => {
    service.fix(8, ' رُمّمت ', 'AAAA').subscribe();
    expect(http.expectOne('/api/Handovers/Note/8/Fix').request.body).toEqual({ fixNote: 'رُمّمت', evidenceVersionId: null, rowVersion: 'AAAA' });

    service.verify(8, '', 'BBBB').subscribe();
    expect(http.expectOne('/api/Handovers/Note/8/Verify').request.body).toEqual({ note: null, evidenceVersionId: null, rowVersion: 'BBBB' });

    service.reject(8, ' لم يُعالَج ', 'CCCC').subscribe();
    expect(http.expectOne('/api/Handovers/Note/8/Reject').request.body).toEqual({ note: 'لم يُعالَج', evidenceVersionId: null, rowVersion: 'CCCC' });

    service.cancel(3, ' خطأ ', 'DDDD').subscribe();
    expect(http.expectOne('/api/Handovers/Cancel/3').request.body).toEqual({ reason: 'خطأ', rowVersion: 'DDDD' });
  });
});
