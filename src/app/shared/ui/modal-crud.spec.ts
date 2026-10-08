import { Injector, computed, runInInjectionContext, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmService } from './confirm.service';
import { ModalCrud } from './modal-crud';
import { PageActions } from './page-actions';
import { ToastService } from './toast.service';

interface Item { id: number; name: string; }

describe('ModalCrud', () => {
  let toasts: string[]; let answer: boolean; let reloads: number;
  let allowed = { create: signal(true), edit: signal(true), delete: signal(true) };
  const service = { create: vi.fn(() => of({})), update: vi.fn(() => of({})), delete: vi.fn(() => of({})) };

  const make = () => {
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () => {
      const createForm = new FormGroup({ name: new FormControl('', Validators.required) });
      const editForm = new FormGroup({ name: new FormControl('', Validators.required) });
      const actions = new PageActions(() => reloads++);
      const crud = new ModalCrud({
        actions, noun: 'الفرع', plural: 'الفروع', titles: { create: 'إنشاء', edit: 'تعديل' },
        can: { create: computed(() => allowed.create()), edit: computed(() => allowed.edit()), delete: computed(() => allowed.delete()) },
        forms: { create: createForm, edit: editForm },
        toEditValue: (i: Item) => ({ name: i.name }),
        toBody: v => { const f = new FormData(); f.append('Name', v.name ?? ''); return f; },
        service
      });
      return { crud, createForm, editForm, actions };
    });
  };

  beforeEach(() => {
    toasts = []; answer = true; reloads = 0;
    allowed = { create: signal(true), edit: signal(true), delete: signal(true) };
    Object.values(service).forEach(f => f.mockClear());
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: { show: (m: string) => toasts.push(m), success: (m: string) => toasts.push(m), error: (m: string) => toasts.push(m) } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(answer) } }
      ]
    });
  });

  it('refuses to open without permission and says so', () => {
    allowed.create.set(false);
    const { crud } = make();
    crud.openCreate();
    expect(crud.activeModal()).toBeNull();
    expect(toasts).toEqual(['لا تملك صلاحية إضافة الفروع']);
  });

  it('opens edit with the record values and a matching title', () => {
    const { crud, editForm } = make();
    crud.openEdit({ id: 3, name: 'الشمال' });
    expect(crud.activeModal()).toBe('edit');
    expect(editForm.value.name).toBe('الشمال');
    expect(crud.modalTitle('edit')).toBe('تعديل');
    expect(crud.selected()?.id).toBe(3);
  });

  it('does not submit an invalid form, and reloads after a valid create', () => {
    const { crud, createForm } = make();
    crud.create();
    expect(service.create).not.toHaveBeenCalled();
    createForm.setValue({ name: 'جديد' });
    crud.create();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(toasts).toContain('تم إنشاء الفرع بنجاح');
    expect(reloads).toBe(1);
    expect(crud.activeModal()).toBeNull();
  });

  it('deletes only after confirmation', async () => {
    const { crud } = make();
    answer = false;
    await crud.remove({ id: 1, name: 'أ' });
    expect(service.delete).not.toHaveBeenCalled();
    answer = true;
    await crud.remove({ id: 1, name: 'أ' });
    expect(service.delete).toHaveBeenCalledWith(1);
    expect(toasts).toContain('تم حذف الفرع بنجاح');
  });
});
