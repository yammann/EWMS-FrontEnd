import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { query } from '../utils/query';
import { StudyApprovalsService } from './study-approvals.service';
import { StudyAttachmentsService } from './study-attachments.service';
import { StudyDocumentsService } from './study-documents.service';
import { StudyDrawingsService } from './study-drawings.service';
import { StudyLookupsService } from './study-lookups.service';
import { StudyPrintService } from './study-print.service';
import { StudyProjectsService } from './study-projects.service';

/** المسارات والأجسام كما في docs/CENTRAL_STUDIES_API.md وcontrollers الدراسات في الباكاند */
describe('Central studies API contract', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps zero and drops empty query values', () => {
    expect(query({ linkedDocument: 0, search: '', branchId: null, kind: undefined, page: 2 })).toBe('?linkedDocument=0&page=2');
    expect(query({})).toBe('');
  });

  it('reads and manages the three lookups on their own routes', () => {
    const service = TestBed.inject(StudyLookupsService);
    service.stageTypes(true).subscribe();
    http.expectOne('/api/StudyLookups/StageTypes/GetAll?activeOnly=true').flush([]);
    service.stageTypes().subscribe();
    http.expectOne('/api/StudyLookups/StageTypes/GetAll').flush([]);

    service.updateStageType(3, { name: 'معماري', defaultOrder: 50, defaultWeight: 30, linkedDocument: 0, isActive: true }).subscribe();
    const put = http.expectOne('/api/StudyLookups/StageTypes/Update/3');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ name: 'معماري', defaultOrder: 50, defaultWeight: 30, linkedDocument: 0, isActive: true });
    put.flush({});

    service.employees({ departmentId: 6 }).subscribe();
    http.expectOne('/api/StudyLookups/Employees?departmentId=6').flush([]);
    service.employees().subscribe();
    http.expectOne('/api/StudyLookups/Employees').flush([]);

    service.lookup('attachmentTypes').subscribe();
    http.expectOne('/api/StudyLookups/AttachmentTypes/GetAll').flush([]);
    service.createLookup('disciplines', { name: 'كهرباء', isActive: true }).subscribe();
    expect(http.expectOne('/api/StudyLookups/Disciplines/Create').request.method).toBe('POST');
    service.deleteLookup('disciplines', 4).subscribe();
    expect(http.expectOne('/api/StudyLookups/Disciplines/Delete/4').request.method).toBe('DELETE');
  });

  it('uses one route shape for the four documents', () => {
    const service = TestBed.inject(StudyDocumentsService);
    service.list('requests', { status: 2, search: 'وزارة', page: 1, pageSize: 20 }).subscribe();
    http.expectOne(r => r.url === '/api/StudyRequests/GetAll?status=2&search=%D9%88%D8%B2%D8%A7%D8%B1%D8%A9&page=1&pageSize=20')
      .flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });

    service.get('startOrders', 7).subscribe();
    http.expectOne('/api/StudyStartOrders/Get/7').flush({});

    service.submit('assignments', 5).subscribe();
    const submit = http.expectOne('/api/StudyAssignments/Submit/5');
    expect(submit.request.method).toBe('PUT');
    submit.flush({});

    service.cancel('responses', 9, '  تكرار الطلب ').subscribe();
    const cancel = http.expectOne('/api/StudyResponses/Cancel/9');
    expect(cancel.request.method).toBe('PUT');
    expect(cancel.request.body).toEqual({ reason: 'تكرار الطلب' });
    cancel.flush({});

    service.activityLog(1).subscribe();
    http.expectOne('/api/StudyActivityLogs/ByRequest/1').flush([]);
  });

  it('sends signature decisions with a trimmed note or null', () => {
    const service = TestBed.inject(StudyApprovalsService);
    service.pending().subscribe();
    http.expectOne('/api/StudyApprovals/Pending').flush([]);
    service.byOwner(10, 3).subscribe();
    http.expectOne('/api/StudyApprovals/ByOwner?ownerType=10&ownerId=3').flush([]);

    service.decide(12, { decision: 2, note: '   ' }).subscribe();
    const approve = http.expectOne('/api/StudyApprovals/Decide/12');
    expect(approve.request.body).toEqual({ decision: 2, note: null });
    approve.flush({});

    service.decide(13, { decision: 4, note: ' ناقص ' }).subscribe();
    expect(http.expectOne('/api/StudyApprovals/Decide/13').request.body).toEqual({ decision: 4, note: 'ناقص' });
  });

  it('maps project, team, stage and task routes', () => {
    const service = TestBed.inject(StudyProjectsService);
    service.addMember(4, 21, ' مهندس ').subscribe();
    const member = http.expectOne('/api/StudyProjects/Members/4');
    expect(member.request.method).toBe('POST');
    expect(member.request.body).toEqual({ userId: 21, roleTitle: 'مهندس' });
    member.flush({});
    service.removeMember(4, 21).subscribe();
    expect(http.expectOne('/api/StudyProjects/Members/4/21').request.method).toBe('DELETE');

    service.reorderStages(2, [5, 3, 4]).subscribe();
    expect(http.expectOne('/api/StudyStages/Reorder/2').request.body).toEqual({ stageIds: [5, 3, 4] });
    service.closeStage(5).subscribe();
    expect(http.expectOne('/api/StudyStages/Close/5').request.method).toBe('PUT');

    service.projectTasks(2).subscribe();
    http.expectOne('/api/StudyTasks/ByProject/2').flush([]);
    service.myTasks(false, 2, 10).subscribe();
    http.expectOne('/api/StudyTasks/My?openOnly=false&page=2&pageSize=10').flush({ items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 0 });
    service.updateProgress(8, { progress: 40, status: 2 }).subscribe();
    expect(http.expectOne('/api/StudyTasks/Progress/8').request.body).toEqual({ progress: 40, status: 2 });
  });

  it('lists, uploads (ids in the query, one file field) and deletes attachments', () => {
    const service = TestBed.inject(StudyAttachmentsService);
    service.list(3, 12).subscribe();
    http.expectOne('/api/StudyAttachments/ByOwner?ownerType=3&ownerId=12').flush([]);

    const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    service.upload(2, 5, 4, file).subscribe();
    const upload = http.expectOne('/api/StudyAttachments/Upload?ownerType=2&ownerId=5&attachmentTypeId=4');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.reportProgress).toBe(true);
    const form = upload.request.body as FormData;
    expect(Array.from(form.keys())).toEqual(['file']);
    expect((form.get('file') as File).name).toBe('plan.pdf');
    upload.flush({});

    service.previewBlob(7).subscribe();
    expect(http.expectOne('/api/StudyAttachments/Get/7').request.responseType).toBe('blob');
    service.remove(7).subscribe();
    expect(http.expectOne('/api/StudyAttachments/Delete/7').request.method).toBe('DELETE');
  });

  it('saves the planning part of a response on its own route and reads print data per document type', () => {
    TestBed.inject(StudyDocumentsService).updateResponsePlanning(3, { requiredDays: 20, staffEstimates: [], logisticItems: [], rowVersion: 'AAA=' }).subscribe();
    const put = http.expectOne('/api/StudyResponses/UpdatePlanning/3');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ requiredDays: 20, staffEstimates: [], logisticItems: [], rowVersion: 'AAA=' });
    put.flush({});

    const print = TestBed.inject(StudyPrintService);
    print.get('start-orders', 4).subscribe();
    http.expectOne('/api/StudyPrint/StartOrder/4').flush({});
    print.get('design-approvals', 2).subscribe();
    http.expectOne('/api/StudyPrint/DesignApproval/2').flush({});
  });

  it('reads the whole study log by its root request', () => {
    TestBed.inject(StudyDocumentsService).activityLog(4).subscribe();
    http.expectOne('/api/StudyActivityLogs/ByRequest/4').flush([]);
    TestBed.inject(StudyProjectsService).activityLog(2).subscribe();
    http.expectOne('/api/StudyProjects/ActivityLog/2').flush([]);
  });

  it('maps drawings, architectural versions and design approvals', () => {
    const service = TestBed.inject(StudyDrawingsService);
    service.byProject(3, 1).subscribe();
    http.expectOne('/api/StudyDrawings/ByProject/3?kind=1').flush([]);
    service.byProject(3).subscribe();
    http.expectOne('/api/StudyDrawings/ByProject/3').flush([]);
    service.createVersion(6, { versionDate: '2026-11-07' }).subscribe();
    expect(http.expectOne('/api/StudyDrawings/Versions/6').request.method).toBe('POST');
    service.review(6, { approve: false, note: ' أعد الحسابات ' }).subscribe();
    expect(http.expectOne('/api/StudyDrawings/Review/6').request.body).toEqual({ approve: false, note: 'أعد الحسابات' });
    service.createDesignApproval({ versionId: 2, cdaDate: '2026-11-07' }).subscribe();
    expect(http.expectOne('/api/StudyDesignApprovals/Create').request.method).toBe('POST');
  });
});
