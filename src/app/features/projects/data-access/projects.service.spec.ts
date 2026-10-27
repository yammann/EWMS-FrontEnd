import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { ProjectsService } from './projects.service';
import { DOCUMENT_KINDS, PROJECT_STAGES, isFinishedStage } from './projects.models';

describe('Projects service', () => {
  let service: ProjectsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only (the server applies the visibility boundary)', () => {
    login([]);
    expect(service.access()).toMatchObject({ canCreate: false, canEdit: false, canUpload: false, canApprove: false, canViewAudit: false });
    login(['CreateProject', 'UploadProjectDocument', 'ViewProjectAudit']);
    expect(service.access()).toMatchObject({ canCreate: true, canEdit: false, canUpload: true, canApprove: false, canViewAudit: true });
    login(['ViewOrganizationDashboard', 'ApproveProjectDocument', 'DeleteProjectDocument']);
    expect(service.access()).toMatchObject({ canChooseBranch: true, canApprove: true, canDeleteDocument: true });
  });

  it('builds the search query with only the filters that are set', () => {
    service.search({ search: ' جسر ', branchId: null, departmentId: 10, siteId: null, stage: 3, page: 2, pageSize: 20 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/Projects/Search'));
    const query = new URLSearchParams(req.request.url.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({ search: 'جسر', departmentId: '10', stage: '3', page: '2', pageSize: '20' });
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 20, totalPages: 0 });
  });

  it('searches documents by project, kind, text and dates', () => {
    service.documents({ projectId: 5, kind: 4, search: 'مخطط', from: '2026-01-01', to: '', page: 1, pageSize: 15 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/ProjectDocuments/Search'));
    expect(Object.fromEntries(new URLSearchParams(req.request.url.split('?')[1])))
      .toEqual({ projectId: '5', kind: '4', search: 'مخطط', from: '2026-01-01', page: '1', pageSize: '15' });
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 15, totalPages: 0 });
  });

  it('uses the member, approval and upload endpoints of the API', () => {
    service.addMember(5, 9, 'مهندس الموقع').subscribe();
    const add = http.expectOne('/api/Projects/Members/5');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ userId: 9, title: 'مهندس الموقع' });
    add.flush({});

    service.removeMember(5, 9).subscribe();
    http.expectOne(r => r.method === 'DELETE' && r.url === '/api/Projects/Members/5/9').flush({});

    service.approve(41).subscribe();
    expect(http.expectOne('/api/ProjectDocuments/Approve/41').request.method).toBe('POST');

    service.completeUpload('abc').subscribe();
    http.expectOne('/api/ProjectUploads/abc/Complete').flush({});
    service.myUploads(5).subscribe();
    http.expectOne('/api/ProjectUploads/Mine?projectId=5').flush([]);
    service.memberCandidates(5, 'ليلى').subscribe();
    http.expectOne(`/api/Projects/MemberCandidates/5?search=${encodeURIComponent('ليلى')}`).flush([]);
  });

  it('points the file path at the version, as a download only when asked', () => {
    expect(service.versionFilePath({ id: 41 }, false)).toBe('/ProjectDocuments/Version/41/File');
    expect(service.versionFilePath({ id: 41 }, true)).toBe('/ProjectDocuments/Version/41/File?download=true');
  });

  it('keeps the stage and kind lists in step with the server enums', () => {
    expect(PROJECT_STAGES.map(s => s.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(isFinishedStage(6) && isFinishedStage(7)).toBe(true);
    expect([1, 2, 3, 4, 5].some(isFinishedStage)).toBe(false);
    expect(DOCUMENT_KINDS).toHaveLength(22);
    expect(DOCUMENT_KINDS.at(-1)).toEqual({ value: 99, label: 'أخرى' });
    expect(new Set(DOCUMENT_KINDS.map(k => k.value)).size).toBe(DOCUMENT_KINDS.length);
  });
});
