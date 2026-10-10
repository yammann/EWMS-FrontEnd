import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ConfirmService } from './confirm.service';
import { CrudPage, CrudPageConfig } from './crud-page';
import { ToastService } from './toast.service';

interface Item { id: number; name: string; }
type Body = { name: string };

describe('CrudPage', () => {
  let toasts: string[]; let answer: boolean; let server: Item[]; let loads: number;
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  const make = (over: Partial<CrudPageConfig<Item, Body>> = {}) => {
    const cfg: CrudPageConfig<Item, Body> = {
      load: () => { loads++; return of(structuredClone(server)); },
      create: b => { const it = { id: server.length + 10, name: b.name }; server.push(it); return of(it); },
      update: (id, b) => { server = server.map(x => x.id === id ? { ...x, name: b.name } : x); return of({}); },
      remove: it => { server = server.filter(x => x.id !== it.id); return of({}); },
      messages: { saved: 'تم الحفظ', deleted: 'تم الحذف', confirmDelete: it => `حذف ${it.name}؟`, plural: 'العناصر' },
      ...over
    };
    return runInInjectionContext(TestBed.inject(Injector), () => new CrudPage<Item, Body>(cfg));
  };

  beforeEach(() => {
    toasts = []; answer = true; loads = 0;
    server = [{ id: 1, name: 'أ' }, { id: 2, name: 'ب' }];
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: { show: (m: string) => toasts.push(m), success: (m: string) => toasts.push(m), error: (m: string) => toasts.push(m) } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(answer) } }
      ]
    });
  });

  it('loads the list; loading only before the first data', async () => {
    const c = make();
    TestBed.tick(); await tick();
    expect(c.items().map(x => x.name)).toEqual(['أ', 'ب']);
    expect(c.loading()).toBe(false);
  });

  it('create: closes the dialog, toasts, and silently reloads', async () => {
    const c = make();
    TestBed.tick(); await tick();
    c.openCreate();
    expect(c.dialog()?.mode).toBe('create');
    c.save({ name: 'ج' });
    TestBed.tick(); await tick();
    expect(c.dialog()).toBeNull();
    expect(toasts).toContain('تم الحفظ');
    expect(c.items().map(x => x.name)).toEqual(['أ', 'ب', 'ج']);
    expect(loads).toBe(2);
  });

  it('a save error stays inside the dialog and keeps it open', async () => {
    const c = make({ create: () => throwError(() => ({ status: 400, message: 'الاسم مستخدم' })) });
    TestBed.tick(); await tick();
    c.openCreate(); c.save({ name: 'أ' });
    expect(c.dialog()).not.toBeNull();
    expect(c.formError()).toBe('الاسم مستخدم');
    expect(c.saving()).toBe(false);
  });

  it('cannot close while saving', async () => {
    const pending = new Subject<unknown>();
    const c = make({ update: () => pending as Observable<unknown> });
    TestBed.tick(); await tick();
    c.openEdit({ id: 1, name: 'أ' }); c.save({ name: 'ب' });
    c.close();
    expect(c.dialog()).not.toBeNull();
    pending.next({}); pending.complete();
    expect(c.dialog()).toBeNull();
  });

  it('delete asks first, then removes locally without reloading', async () => {
    const c = make();
    TestBed.tick(); await tick();
    answer = false;
    await c.remove({ id: 1, name: 'أ' });
    expect(c.items().length).toBe(2);
    answer = true;
    await c.remove({ id: 1, name: 'أ' });
    expect(c.items().map(x => x.id)).toEqual([2]);
    expect(toasts).toContain('تم الحذف');
    expect(loads).toBe(1);
  });

  it('refuses without permission and explains', async () => {
    const c = make({ can: { create: () => false } });
    c.openCreate();
    expect(c.dialog()).toBeNull();
    expect(toasts).toEqual(['لا تملك صلاحية إضافة العناصر']);
  });

  it('keeps the last list visible and reports a load failure', async () => {
    let fail = false;
    const c = make({ load: () => fail ? throwError(() => ({ status: 500, message: 'تعطّل الخادم' })) : of([{ id: 1, name: 'أ' }]) });
    TestBed.tick(); await tick();
    fail = true; c.refresh(); TestBed.tick(); await tick();
    expect(c.items().map(x => x.name)).toEqual(['أ']);
    expect(c.loadError()).toBe('تعطّل الخادم');
  });
});
