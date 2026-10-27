import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { SCHEDULE_ACCESS } from '@core/constants/access';
import { ScheduleService } from './schedule.service';
import { dateOnly, percent } from './schedule.models';

describe('Schedule service', () => {
  let service: ScheduleService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ScheduleService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives the buttons from the permissions only', () => {
    login([]);
    expect(service.access()).toMatchObject({ canRecordDelay: false, canDecideDelay: false, canRequestExtension: false, canDecideExtension: false, canListDocuments: false });
    login(['RecordScheduleDelay', 'ApproveScheduleExtension', 'ViewProjectDocuments']);
    expect(service.access()).toMatchObject({ canRecordDelay: true, canDecideDelay: false, canRequestExtension: false, canDecideExtension: true, canListDocuments: true });
  });

  it('the schedule tab opens with any one of the schedule permissions (same as the AnyScheduleView policy)', () => {
    expect(SCHEDULE_ACCESS).toHaveLength(10);
    login(['ViewProjectSchedule']);
    expect(TestBed.inject(AuthService).hasAnyPermission(SCHEDULE_ACCESS)).toBe(true);
    login(['ViewProjects']);
    expect(TestBed.inject(AuthService).hasAnyPermission(SCHEDULE_ACCESS)).toBe(false);
  });

  it('uses the schedule, task and dependency endpoints', () => {
    service.overview(5).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Overview/5').request.method).toBe('GET');

    service.createDraft(5, 'مراجعة', '').subscribe();
    const draft = http.expectOne('/api/ProjectSchedules/Draft/5');
    expect(draft.request.method).toBe('POST');
    expect(draft.request.body).toEqual({ title: 'مراجعة', note: '' });
    draft.flush({});

    service.addTask(7, { code: '1', name: 'حفر', plannedStart: '2026-11-01', plannedEnd: '2026-11-10', weight: 2, note: '', assigneeUserId: null }).subscribe();
    const added = http.expectOne('/api/ProjectSchedules/Tasks/7');
    expect(added.request.body).toMatchObject({ name: 'حفر', weight: 2 });
    added.flush({});

    service.updateTask(3, { code: '', name: 'x', plannedStart: '', plannedEnd: '', weight: 1, note: '', assigneeUserId: null, rowVersion: 'AAA=' }).subscribe();
    const update = http.expectOne('/api/ProjectSchedules/Task/3');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.rowVersion).toBe('AAA=');
    update.flush({});

    service.reorder(7, [3, 1, 2]).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Reorder/7').request.body).toEqual({ taskIds: [3, 1, 2] });

    service.addDependency(7, 1, 2).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Dependencies/7').request.body).toEqual({ predecessorId: 1, successorId: 2 });
    service.removeDependency(9).subscribe();
    expect(http.expectOne(r => r.method === 'DELETE' && r.url === '/api/ProjectSchedules/Dependency/9')).toBeTruthy();

    service.approve(7).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Approve/7').request.method).toBe('POST');
  });

  it('sends progress and classification with the row version the user saw', () => {
    service.updateProgress(3, { status: 2, progress: 40, actualStart: '2026-11-02', actualEnd: null, note: '', rowVersion: 'BBB=' }).subscribe();
    const progress = http.expectOne('/api/ProjectSchedules/Progress/3');
    expect(progress.request.method).toBe('PUT');
    expect(progress.request.body).toMatchObject({ progress: 40, rowVersion: 'BBB=' });
    progress.flush({});

    service.classify(3, true, 'CCC=').subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Classify/3').request.body).toEqual({ isCritical: true, rowVersion: 'CCC=' });
    service.progressHistory(3).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Progress/3').request.method).toBe('GET');
  });

  it('uses the delay endpoints: record, justify, decide', () => {
    service.recordDelay(3, { kind: 1, discoveredAt: '2026-11-20', reason: 'مواد', actions: '', affectedTaskIds: [4] }).subscribe();
    const record = http.expectOne('/api/ProjectSchedules/RecordDelay/3');
    expect(record.request.method).toBe('POST');
    expect(record.request.body.affectedTaskIds).toEqual([4]);
    record.flush({});

    service.justifyDelay(20, { reason: 'r', actions: '', approvalAuthority: 'إدارة', approvalDate: '2026-11-19', approvalDocumentVersionId: 40, affectsCriticalWork: false, affectedTaskIds: [] }).subscribe();
    const justify = http.expectOne('/api/ProjectSchedules/Delay/20/Justify');
    expect(justify.request.method).toBe('PUT');
    expect(justify.request.body.approvalDocumentVersionId).toBe(40);
    justify.flush({});

    service.decideDelay(20, { approve: false, note: 'غير كاف', rowVersion: 'D=' }).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Delay/20/Decide').request.body).toEqual({ approve: false, note: 'غير كاف', rowVersion: 'D=' });
  });

  it('uses the extension endpoints: preview, create, update, submit, delete, decide', () => {
    const input = { delayId: null, mode: 1, dayCount: 2, reason: 'طقس', lines: [{ taskId: 1, days: 5, movesStart: false }], documentVersionIds: [] };
    service.previewExtension(5, input).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Extensions/5/Preview').request.body).toEqual(input);
    service.createExtension(5, input).subscribe();
    expect(http.expectOne(r => r.method === 'POST' && r.url === '/api/ProjectSchedules/Extensions/5').request.body.dayCount).toBe(2);
    service.updateExtension(30, input).subscribe();
    expect(http.expectOne(r => r.method === 'PUT' && r.url === '/api/ProjectSchedules/Extension/30')).toBeTruthy();
    service.submitExtension(30).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Extension/30/Submit').request.method).toBe('POST');
    service.deleteExtension(30).subscribe();
    expect(http.expectOne(r => r.method === 'DELETE' && r.url === '/api/ProjectSchedules/Extension/30')).toBeTruthy();
    service.decideExtension(30, { approve: true, note: '' }).subscribe();
    expect(http.expectOne('/api/ProjectSchedules/Extension/30/Decide').request.method).toBe('PUT');
  });

  it('formats dates and percentages for the screens', () => {
    expect(dateOnly('2026-11-05T00:00:00')).toBe('2026-11-05');
    expect(dateOnly(null)).toBe('');
    expect(percent(33.333)).toBe('33.3%');
    expect(percent(null)).toBe('—');
  });
});
