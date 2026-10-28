import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { DiwanService } from './diwan.service';
import { CorrespondenceFilter } from './diwan.models';

describe('Diwan service', () => {
  let service: DiwanService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DiwanService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  const filter = (patch: Partial<CorrespondenceFilter> = {}): CorrespondenceFilter => ({
    direction: null, typeId: null, statusId: null, stage: null, projectId: null, search: '', from: '', to: '', overdueOnly: false, inbox: false, page: 1, pageSize: 20, ...patch
  });

  it('derives the buttons from the permissions only (the server decides what each item allows)', () => {
    login([]);
    expect(service.access()).toMatchObject({ canRegister: false, canHandle: false, canManageLookups: false, canChooseBranch: false });
    login(['RegisterCorrespondence', 'HandleCorrespondence', 'CreateCorrespondenceLookup', 'ExportOverdueCorrespondenceReport']);
    expect(service.access()).toMatchObject({ canRegister: true, canHandle: true, canManageLookups: true, canCreateLookup: true, canEditLookup: false, canViewReport: true });
    login(['ViewOrganizationDashboard', 'ViewProjects']);
    expect(service.access()).toMatchObject({ canChooseBranch: true, canListProjects: true });
  });

  it('builds the search query with only the filters that are set', () => {
    service.search(filter({ search: ' IN-2026 ', direction: 1, stage: 2, overdueOnly: true, inbox: true, page: 3 })).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/Correspondence/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1]))).toEqual({
      direction: '1', stage: '2', search: 'IN-2026', overdueOnly: 'true', inbox: 'true', page: '3', pageSize: '20'
    });
    req.flush({ items: [], totalCount: 0, page: 3, pageSize: 20, totalPages: 0 });
  });

  it('asks for inactive lookups only when requested and scopes them to a branch', () => {
    service.types(5, true).subscribe();
    http.expectOne('/api/CorrespondenceTypes/GetAll?branchId=5&includeInactive=true').flush([]);
    service.statuses().subscribe();
    http.expectOne('/api/CorrespondenceStatuses/GetAll?').flush([]);
  });

  it('refers, changes status and decides with the row version the user saw', () => {
    service.refer(7, { toDepartmentId: 3, toOfficeId: null, toUserId: 9, note: 'ن' }).subscribe();
    const refer = http.expectOne('/api/Correspondence/Refer/7');
    expect(refer.request.body).toEqual({ toDepartmentId: 3, toOfficeId: null, toUserId: 9, note: 'ن' });
    refer.flush({});

    service.setStatus(7, 4, 'AAAA').subscribe();
    expect(http.expectOne('/api/Correspondence/Status/7').request.body).toEqual({ statusId: 4, rowVersion: 'AAAA' });

    service.decide(7, false, '  أعد الصياغة ', 'BBBB').subscribe();
    expect(http.expectOne('/api/Correspondence/Decide/7').request.body).toEqual({ approve: false, note: 'أعد الصياغة', rowVersion: 'BBBB' });
  });

  it('uploads files as multipart under the "files" field', () => {
    service.attach(7, [new File(['%PDF-'], 'كتاب.pdf', { type: 'application/pdf' })]).subscribe();
    const req = http.expectOne('/api/Correspondence/Attachments/7');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).getAll('files')).toHaveLength(1);
  });

  it('reads the referral targets for the item branch and the users of a unit', () => {
    service.referralTargets(2).subscribe();
    http.expectOne('/api/Correspondence/ReferralTargets?branchId=2').flush([]);
    service.referralUsers(3, 8).subscribe();
    http.expectOne('/api/Correspondence/ReferralUsers?departmentId=3&officeId=8').flush([]);
  });
});
