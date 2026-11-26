import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { AppNotification } from '@core/models/notification.models';
import { MaintenanceTask } from '../../data-access/maintenance.models';
import { MaintenanceTasksPage } from './tasks-page';

const TASKS = '/api/MaintenanceTasks/GetAll?page=1&pageSize=';
const task = (over: Partial<MaintenanceTask> = {}) => ({
  id: 7, userId: 4, userName: 'سامر', taskLocation: 'مبنى الإدارة', requestingParty: 'الخدمات', requiredWork: 'صيانة مكيف',
  completedWorks: '', startedAt: null, completedAt: null, canEdit: true, canAssign: true, ...over
}) as MaintenanceTask;

function setup(permissions: string[], taskParam: string | null = null) {
  const query = new BehaviorSubject(convertToParamMap(taskParam ? { task: taskParam } : {}));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { queryParamMap: query } }
    ]
  });
  TestBed.inject(AuthService).currentUser.set({
    email: 't@e.test', fullName: 'رئيس القسم', role: 'x', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions
  });
  const page = TestBed.createComponent(MaintenanceTasksPage).componentInstance;
  const http = TestBed.inject(HttpTestingController);
  return { page, http };
}

/** يرد على طلبي البداية: قائمة الموظفين ثم المهام */
function answerStart(http: HttpTestingController, employees: { id: number; fullName: string }[], tasks: MaintenanceTask[]) {
  http.expectOne('/api/MaintenanceRequests/Assignees').flush(employees);
  http.expectOne(r => r.url.startsWith(TASKS)).flush({ items: tasks, totalCount: tasks.length, page: 1, pageSize: 20, totalPages: 1 });
}

describe('MaintenanceTasksPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('tells the task state from its start and completion times', () => {
    const { page, http } = setup(['ViewMaintenanceTasks']);
    answerStart(http, [], []);
    expect(page.state(task())).toBe('new');
    expect(page.state(task({ startedAt: '2026-11-25T08:00:00' }))).toBe('running');
    expect(page.state(task({ startedAt: '2026-11-25T08:00:00', completedAt: '2026-11-25T10:00:00' }))).toBe('done');
  });

  it('opens a task read-only when the user cannot edit it, and never saves it', () => {
    const { page, http } = setup(['ViewMaintenanceTasks', 'EditMaintenanceTask']);
    answerStart(http, [], []);
    page.openForm(task({ canEdit: false }));
    expect(page.readOnly()).toBe(true);
    expect(page.form.disabled).toBe(true);
    page.save();
    http.expectNone(r => r.url.includes('/MaintenanceTasks/Update'));

    page.openForm(task());
    expect(page.readOnly()).toBe(false);
    expect(page.form.enabled).toBe(true);
  });

  it('refuses a completion time before the start time', () => {
    const { page, http } = setup(['ViewMaintenanceTasks', 'CreateMaintenanceTask']);
    answerStart(http, [], []);
    page.openForm(null);
    page.form.patchValue({ taskLocation: 'المستودع', requestingParty: 'الإدارة', requiredWork: 'فحص', startedAt: '2026-11-25T10:00', completedAt: '2026-11-25T09:00' });
    expect(page.dateError()).toBe(true);
    page.save();
    http.expectNone('/api/MaintenanceTasks/Create');
    page.form.patchValue({ completedAt: '2026-11-25T11:00' });
    expect(page.dateError()).toBe(false);
  });

  it('creates a task with trimmed text, empty times as null, and no assignee for a user who cannot direct tasks', () => {
    const { page, http } = setup(['ViewMaintenanceTasks', 'CreateMaintenanceTask']);
    answerStart(http, [], []);
    page.openForm(null);
    page.form.patchValue({ taskLocation: ' المستودع ', requestingParty: ' الإدارة ', requiredWork: ' فحص الإنارة ' });
    page.save();
    const req = http.expectOne('/api/MaintenanceTasks/Create');
    expect(req.request.body).toEqual({
      taskLocation: 'المستودع', requestingParty: 'الإدارة', requiredWork: 'فحص الإنارة', completedWorks: '',
      startedAt: null, completedAt: null, assigneeId: null
    });
    req.flush(task({ id: 8 }));
    http.expectOne(r => r.url.startsWith(TASKS)).flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
    expect(page.formOpen()).toBe(false);
  });

  it('saves the edit first and then moves the task when its employee changes', () => {
    const { page, http } = setup(['ViewMaintenanceTasks', 'EditMaintenanceTask', 'AssignMaintenanceTask']);
    answerStart(http, [{ id: 4, fullName: 'سامر' }, { id: 5, fullName: 'رنا' }], [task()]);
    page.openForm(task());
    expect(page.canPickEmployee()).toBe(true);
    page.form.patchValue({ assigneeId: 5 });
    page.save();
    http.expectOne('/api/MaintenanceTasks/Update/7').flush(task());
    const assign = http.expectOne('/api/MaintenanceTasks/Assign/7');
    expect(assign.request.body).toEqual({ userId: 5 });
    assign.flush(task({ userId: 5, userName: 'رنا' }));
    http.expectOne(r => r.url.startsWith(TASKS)).flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
  });

  it('opens the task named in a notification link once the list arrives', () => {
    const { page, http } = setup(['ViewMaintenanceTasks', 'EditMaintenanceTask'], '7');
    expect(page.formOpen()).toBe(false);
    answerStart(http, [], [task({ id: 6 }), task({ id: 7, taskLocation: 'المختبر' })]);
    expect(page.formOpen()).toBe(true);
    expect(page.editing()?.taskLocation).toBe('المختبر');
  });

  it('reloads on maintenance-task notifications only', () => {
    const { http } = setup(['ViewMaintenanceTasks']);
    answerStart(http, [], []);
    const notifications = TestBed.inject(NotificationService);
    notifications.incoming$.next({ id: 1, relatedEntityType: 'Vacation' } as AppNotification);
    http.expectNone(r => r.url.startsWith(TASKS));
    notifications.incoming$.next({ id: 2, relatedEntityType: 'MaintenanceTask' } as AppNotification);
    http.expectOne(r => r.url.startsWith(TASKS)).flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
  });
});
