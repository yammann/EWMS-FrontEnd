import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AssignedTaskService } from './assigned-task.service';
import { notificationRoute } from './notification.service';
import { AppNotification } from '@core/models/notification.models';
import { linkRoute } from '@features/task-board/task-links';

describe('Task board API contract', () => {
  let service: AssignedTaskService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AssignedTaskService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends the numeric status the backend enum expects when a card is dropped', () => {
    service.changeStatus(7, 'InProgress').subscribe();
    const req = http.expectOne('/api/AssignedTasks/Status/7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 2, note: null });
    req.flush({});
  });

  it('sends the review status value and the return note', () => {
    service.changeStatus(7, 'InReview').subscribe();
    http.expectOne('/api/AssignedTasks/Status/7').flush({});
    service.changeStatus(7, 'InProgress', 'ينقصها تقرير').subscribe();
    const req = http.expectOne('/api/AssignedTasks/Status/7');
    expect(req.request.body).toEqual({ status: 2, note: 'ينقصها تقرير' });
    req.flush({});
  });

  it('uploads attachments one file per request, in order', () => {
    const a = new File(['a'], 'a.pdf'), b = new File(['b'], 'b.png');
    const progress: number[] = [];
    service.attachSequentially(5, [a, b], done => progress.push(done)).subscribe();
    http.expectOne('/api/AssignedTasks/Attachments/5').flush({});
    http.expectOne('/api/AssignedTasks/Attachments/5').flush({});
    expect(progress).toEqual([1, 2]);
  });


  it('builds the export url from the active filters only', () => {
    service.exportExcel({ mode: 'scope', doneDays: 90, q: 'جرد', overdueOnly: true }).subscribe();
    const req = http.expectOne(r => r.urlWithParams.startsWith('/api/AssignedTasks/Export?'));
    const query = new URLSearchParams(req.request.urlWithParams.split('?')[1]);
    expect(query.get('mode')).toBe('scope');
    expect(query.get('doneDays')).toBe('90');
    expect(query.get('q')).toBe('جرد');
    expect(query.get('overdueOnly')).toBe('true');
    expect(query.has('priority')).toBe(false);
    req.flush(new Blob());
  });

  it('posts a link by reference or by id, and reads linked tasks of a record', () => {
    service.addLink(4, 'MaintenanceRequest', 'MR-2026-00012').subscribe();
    const add = http.expectOne('/api/AssignedTasks/Links/4');
    expect(add.request.body).toEqual({ entityType: 'MaintenanceRequest', reference: 'MR-2026-00012', entityId: null });
    add.flush([]);
    service.byLink('Site', 9).subscribe();
    http.expectOne('/api/AssignedTasks/ByLink?entityType=Site&entityId=9').flush([]);
  });

  it('routes record links to their own pages', () => {
    expect(linkRoute('MaintenanceRequest', 12, false)).toBe('/maintenance/requests/12');
    expect(linkRoute('Site', 3, false)).toBe('/devices/sites/3');
    expect(linkRoute('Vacation', 5, false)).toBeNull();
    expect(linkRoute('Vacation', 5, true)).toBe('/vacations/print/5');
  });

  it('sends the numeric priority and checklist when creating from a template', () => {
    service.create({ title: 'ت', description: '', priority: 3, dueDate: null, targetId: 4, parentTaskId: null, checklistItems: ['أ', 'ب'] }).subscribe();
    const req = http.expectOne('/api/AssignedTasks/Create');
    expect(req.request.body.checklistItems).toEqual(['أ', 'ب']);
    req.flush({});
  });

  it('requests the board for the chosen view', () => {
    service.board('outgoing').subscribe();
    http.expectOne('/api/AssignedTasks/Board?mode=outgoing').flush({ tasks: [] });
  });

  it('creates a delegated subtask with its parent id', () => {
    service.create({ title: 'ت', description: '', priority: 3, dueDate: null, targetId: 4, parentTaskId: 9 }).subscribe();
    const req = http.expectOne('/api/AssignedTasks/Create');
    expect(req.request.body.parentTaskId).toBe(9);
    req.flush({});
  });

  it('deep-links task notifications to the board with the task open', () => {
    const n = { relatedEntityType: 'AssignedTask', relatedEntityId: 12, type: 'TaskAssigned' } as AppNotification;
    expect(notificationRoute(n, false)).toBe('/task-board?task=12');
  });
});
