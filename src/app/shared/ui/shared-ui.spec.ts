import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { PageActions, errorMessage } from '@shared/ui/page-actions';
import { roleLabel } from '@core/utils/roles';

describe('ConfirmService', () => {
  it('resolves true on confirm and clears the dialog', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const answer = confirm.ask('حذف؟', 'حذف');
    expect(confirm.current()?.confirmLabel).toBe('حذف');
    confirm.answer(true);
    expect(await answer).toBe(true);
    expect(confirm.current()).toBeNull();
  });

  it('a new question cancels the pending one', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const first = confirm.ask('أولاً؟');
    const second = confirm.ask('ثانياً؟');
    expect(await first).toBe(false);
    confirm.answer(true);
    expect(await second).toBe(true);
  });
});

describe('ToastService', () => {
  afterEach(() => vi.useRealTimers());

  it('shows then auto-dismisses a toast', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(ToastService);
    toast.success('تم');
    expect(toast.toasts().map(t => t.message)).toEqual(['تم']);
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toEqual([]);
  });
});

describe('PageActions', () => {
  const create = (reload: () => void) => TestBed.runInInjectionContext(() => new PageActions(reload));

  it('tracks the running action, toasts success, runs "after" and reloads', () => {
    const reload = vi.fn(); const after = vi.fn();
    const actions = create(reload);
    const request = new Subject<void>();
    actions.run('delete-3', request, 'تم الحذف', after);
    expect(actions.saving()).toBe('delete-3');
    request.next(); request.complete();
    expect(actions.saving()).toBeNull();
    expect(after).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ type: 'success', message: 'تم الحذف' });
  });

  it('shows the API message on failure without reloading', () => {
    const reload = vi.fn();
    const actions = create(reload);
    actions.run('create', throwError(() => ({ status: 400, message: 'يوجد فرع بنفس الاسم' })), 'تم');
    expect(actions.saving()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ type: 'error', message: 'يوجد فرع بنفس الاسم' });
  });

  it('errorMessage falls back when the error has no message', () => {
    expect(errorMessage({}, 'بديل')).toBe('بديل');
    expect(errorMessage(null, 'بديل')).toBe('بديل');
    expect(errorMessage({ error: { message: 'من الخادم' } }, 'بديل')).toBe('من الخادم');
  });
});

describe('Role helpers', () => {
  it('shows role names as written, except the general system admin role', () => {
    expect(roleLabel('SuperAdmin')).toBe('مدير النظام');
    expect(roleLabel('superadmin')).toBe('مدير النظام');
    expect(roleLabel('موظف إداري')).toBe('موظف إداري');
    expect(roleLabel(null)).toBe('');
  });
});
