import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ToDoService } from './todo.service';

describe('To-do lists API contract', () => {
  let service: ToDoService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ToDoService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads my lists, and another owner only when asked', () => {
    service.lists().subscribe();
    http.expectOne('/api/ToDoLists/GetAll').flush([]);
    service.lists(7).subscribe();
    http.expectOne('/api/ToDoLists/GetAll?ownerId=7').flush([]);
  });

  it('creates and updates a list with a JSON body', () => {
    service.create({ name: 'أ', description: '', color: 'blue', icon: '📝' }).subscribe();
    const create = http.expectOne('/api/ToDoLists/Create');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'أ', description: '', color: 'blue', icon: '📝' });
    create.flush({});
    service.update(3, { name: 'ب', description: 'د', color: '', icon: '' }).subscribe();
    const update = http.expectOne('/api/ToDoLists/Update/3');
    expect(update.request.method).toBe('PUT');
    update.flush({});
  });

  it('sends the smart list operations to their endpoints', () => {
    service.pin(4, true).subscribe();
    const pin = http.expectOne('/api/ToDoLists/Pin/4');
    expect(pin.request.method).toBe('PUT'); expect(pin.request.body).toEqual({ value: true }); pin.flush({});
    service.archive(4, false).subscribe();
    expect(http.expectOne('/api/ToDoLists/Archive/4').request.body).toEqual({ value: false });
    service.duplicate(4).subscribe();
    expect(http.expectOne('/api/ToDoLists/Duplicate/4').request.method).toBe('POST');
    service.today().subscribe();
    http.expectOne('/api/ToDoLists/Today').flush({ overdueCount: 0, todayCount: 0, items: [] });
  });

  it('adds an item with its options, in bulk, and from a board task', () => {
    service.addItem(2, { title: 'ب', dueDate: '2026-10-10', isImportant: true, repeat: 2 }).subscribe();
    const add = http.expectOne('/api/ToDoLists/Items/2');
    expect(add.request.body).toEqual({ title: 'ب', dueDate: '2026-10-10', isImportant: true, repeat: 2 });
    add.flush({});
    service.bulkAdd(2, ['أ', 'ب']).subscribe();
    expect(http.expectOne('/api/ToDoLists/Items/2/Bulk').request.body).toEqual({ titles: ['أ', 'ب'] });
    service.addTask(2, 77).subscribe();
    expect(http.expectOne('/api/ToDoLists/Items/2/FromTask').request.body).toEqual({ taskId: 77 });
  });

  it('clears a due date and cancels repeat explicitly', () => {
    service.updateItem(5, { clearDueDate: true, repeat: 0 }).subscribe();
    expect(http.expectOne('/api/ToDoLists/Item/5').request.body).toEqual({ clearDueDate: true, repeat: 0 });
  });

  it('sends item operations to the endpoints the backend expects', () => {
    service.addItem(2, 'بند').subscribe();
    const add = http.expectOne('/api/ToDoLists/Items/2');
    expect(add.request.body).toEqual({ title: 'بند' });
    add.flush({});

    service.updateItem(9, { isDone: true }).subscribe();
    const upd = http.expectOne('/api/ToDoLists/Item/9');
    expect(upd.request.method).toBe('PUT');
    expect(upd.request.body).toEqual({ isDone: true });
    upd.flush({});

    service.deleteItem(9).subscribe();
    expect(http.expectOne('/api/ToDoLists/Item/9').request.method).toBe('DELETE');

    service.reorder(2, [5, 3, 4]).subscribe();
    const re = http.expectOne('/api/ToDoLists/Reorder/2');
    expect(re.request.body).toEqual({ itemIds: [5, 3, 4] });
    re.flush({});

    service.clearDone(2).subscribe();
    const clear = http.expectOne('/api/ToDoLists/ClearDone/2');
    expect(clear.request.method).toBe('DELETE');
    clear.flush({});
  });
});
