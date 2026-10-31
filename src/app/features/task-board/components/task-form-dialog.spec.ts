import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { TaskFormDialog } from './task-form-dialog';

const option = (kind: string, id: number, name: string, extra: object = {}) => ({ kind, id, name, headNames: '', detail: '', ...extra });

describe('Task form: one grouped list of targets, no type step', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewTaskBoard'], fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });
  afterEach(() => http.verify());

  const open = (mode: 'create' | 'delegate', targets: object[], task?: object) => {
    const fixture = TestBed.createComponent(TaskFormDialog);
    fixture.componentRef.setInput('mode', mode);
    if (task) fixture.componentRef.setInput('task', task);
    fixture.detectChanges();
    http.expectOne(mode === 'create' ? '/api/AssignedTasks/Targets' : '/api/AssignedTasks/Targets?parentTaskId=7').flush(targets);
    fixture.detectChanges();
    return fixture;
  };

  it('asks for every allowed target without a type and groups them: departments, offices, employees', () => {
    const fixture = open('create', [
      option('User', 5, 'منفِّذ', { detail: 'العمليات / مكتب البرمجة' }), option('Office', 2, 'مكتب البرمجة', { headNames: 'خالد' }), option('Department', 1, 'العمليات', { headNames: 'أحمد' })
    ]);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.segmented.types')).toBeNull();                                            // لا مبدّل نوع
    expect([...el.querySelectorAll('optgroup')].map(g => g.getAttribute('label'))).toEqual(['الأقسام', 'المكاتب', 'الموظفون']);
    expect([...el.querySelectorAll('optgroup')[2].querySelectorAll('option')].map(o => o.textContent?.trim())).toEqual(['منفِّذ — العمليات / مكتب البرمجة']);
  });

  it('sends the kind of the picked item with the task, so the type is never chosen by the user', () => {
    const fixture = open('create', [option('Office', 3, 'مكتب'), option('User', 3, 'موظف')]);     // المعرّف نفسه لنوعين
    const dialog = fixture.componentInstance;
    dialog.form.patchValue({ title: 'مهمة', targetId: 'User:3' });
    dialog.submit();

    const req = http.expectOne('/api/AssignedTasks/Create');
    expect(req.request.body).toMatchObject({ title: 'مهمة', targetId: 3, targetType: 'User', parentTaskId: null });
    req.flush({ id: 1 });
  });

  it('refuses to save without a chosen target and shows the search box only for long lists', () => {
    const fixture = open('create', Array.from({ length: 12 }, (_, i) => option('User', i + 1, 'موظف ' + (i + 1))));
    const dialog = fixture.componentInstance;
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=search]')).not.toBeNull();

    dialog.form.patchValue({ title: 'مهمة' });
    dialog.submit();
    http.expectNone('/api/AssignedTasks/Create');
    expect(dialog.error()).toBe('اختر الجهة');

    dialog.filter.set('موظف 12');
    expect(dialog.groups()[0].items.map(t => t.id)).toEqual([12]);
  });

  it('delegation lists the offices and employees of the parent task together and posts the picked kind', () => {
    const task = { id: 7, title: 'مهمة القسم', targetType: 'Department', priority: 'Normal', dueDate: null, delegationTypes: [] };
    const fixture = open('delegate', [option('Office', 2, 'مكتب البرمجة'), option('User', 5, 'موظف القسم', { detail: 'العمليات' })], task);
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('optgroup')].map(g => g.getAttribute('label'))).toEqual(['المكاتب', 'الموظفون']);

    fixture.componentInstance.form.patchValue({ title: 'جزء', targetId: 'User:5' });
    fixture.componentInstance.submit();
    const req = http.expectOne('/api/AssignedTasks/Create');
    expect(req.request.body).toMatchObject({ targetId: 5, targetType: 'User', parentTaskId: 7 });
    req.flush({ id: 9 });
  });
});
