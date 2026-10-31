import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { TaskBoardPage } from './task-board-page';

const card = (id: number, status: string) => ({
  id, title: 'مهمة ' + id, priority: 'Normal', priorityAr: 'عادية', status, statusAr: '', dueDate: null, isOverdue: false, targetType: 'Office',
  targetName: 'مكتب', targetPath: 'فرع', createdByUserId: 1, createdByName: 'مسنِد', parentTaskId: null, parentTitle: null, subTasksTotal: 0, subTasksDone: 0,
  commentsCount: 0, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', completedAt: null, canChangeStatus: false, allowedStatuses: [],
  needsReturnNote: false, attachmentsCount: 0, checklistTotal: 0, checklistDone: 0, claimedByUserId: null, claimedByName: null
});

describe('Task board paging', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewTaskBoard'], fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });
  afterEach(() => http.verify());

  const boardOf = (todo: number, progress: number) => ({
    mode: 'incoming', canCreate: false, targetTypeLabel: '', targetTypes: [], hasScope: false,
    tasks: [...Array.from({ length: todo }, (_, i) => card(i + 1, 'Todo')), ...Array.from({ length: progress }, (_, i) => card(1000 + i, 'InProgress'))]
  });

  it('shows ten cards per column, keeps the full count in the header and pages each column on its own', () => {
    const fixture = TestBed.createComponent(TaskBoardPage);
    fixture.detectChanges();
    http.expectOne(r => r.url.startsWith('/api/AssignedTasks/Board')).flush(boardOf(25, 4));
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    expect(page.pagers.Todo.items()).toHaveLength(10);
    expect(page.pagers.Todo.total()).toBe(25);
    expect(page.pagers.InProgress.items()).toHaveLength(4);              // عمود صغير بلا ترقيم
    expect(el.querySelectorAll('.column.c-Todo article.card')).toHaveLength(10);
    expect(el.querySelector('.column.c-Todo .col-count')?.textContent?.trim()).toBe('25');
    expect(el.querySelector('.column.c-Todo app-pager nav')).not.toBeNull();
    expect(el.querySelector('.column.c-InProgress app-pager nav')).toBeNull();

    page.pagers.Todo.go(3);
    fixture.detectChanges();
    expect(page.pagers.Todo.items().map(t => t.id)).toEqual([21, 22, 23, 24, 25]);
    expect(page.pagers.InProgress.page()).toBe(1);                        // الأعمدة الأخرى لا تتأثر
  });

  it('returns every column to its first page when a filter changes', () => {
    const fixture = TestBed.createComponent(TaskBoardPage);
    fixture.detectChanges();
    http.expectOne(r => r.url.startsWith('/api/AssignedTasks/Board')).flush(boardOf(25, 0));
    fixture.detectChanges();

    const page = fixture.componentInstance;
    page.pagers.Todo.go(2);
    expect(page.pagers.Todo.page()).toBe(2);
    page.search.set('مهمة 2');
    fixture.detectChanges();
    expect(page.pagers.Todo.page()).toBe(1);
    expect(page.pagers.Todo.total()).toBe(7);                             // مهمة 2 و20–25
  });
});
