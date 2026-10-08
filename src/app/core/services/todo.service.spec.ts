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
    service.create({ name: 'أ', description: '' }).subscribe();
    const create = http.expectOne('/api/ToDoLists/Create');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'أ', description: '' });
    create.flush({});
    service.update(3, { name: 'ب', description: 'د' }).subscribe();
    const update = http.expectOne('/api/ToDoLists/Update/3');
    expect(update.request.method).toBe('PUT');
    update.flush({});
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
