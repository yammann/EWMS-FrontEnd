import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AssignedTaskService } from './assigned-task.service';
import { notificationRoute } from './notification.service';
import { AppNotification } from '../models/notification.models';

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
