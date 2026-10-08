import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { loader } from './loader';

describe('loader()', () => {
  const make = <T>(source: () => Observable<T>, initial: T, opts = {}) => {
    return runInInjectionContext(TestBed.inject(Injector), () => loader(source, initial, opts));
  };
  const tick = () => new Promise<void>(r => setTimeout(r));

  it('loads immediately, exposes data and clears loading', async () => {
    const l = make(() => of([1, 2]), [] as number[]);
    expect(l.loading()).toBe(true);
    await tick();
    expect(l.data()).toEqual([1, 2]);
    expect(l.loading()).toBe(false);
    expect(l.error()).toBe('');
  });

  it('keeps the previous data and reports the message on failure', async () => {
    let fail = false;
    const l = make(() => fail ? throwError(() => ({ status: 500, message: 'تعطّل' })) : of('قديم'), '');
    await tick();
    fail = true; l.reload(); await tick();
    expect(l.data()).toBe('قديم');
    expect(l.error()).toBe('تعطّل');
    expect(l.loading()).toBe(false);
  });

  it('calls onLoaded / onError', async () => {
    const loaded: number[] = []; const errors: unknown[] = [];
    const l = make(() => of(7), 0, { onLoaded: (v: number) => loaded.push(v) });
    await tick(); expect(loaded).toEqual([7]);
    TestBed.resetTestingModule();
    make(() => throwError(() => 'x'), 0, { onError: (e: unknown) => errors.push(e) });
    await tick(); expect(errors).toEqual(['x']);
    expect(l).toBeTruthy();
  });
});

describe('trackRequest()', () => {
  it('toggles busy, clears error, and reports failure message', async () => {
    const { signal } = await import('@angular/core');
    const { trackRequest } = await import('./loader');
    const busy = signal(false), error = signal('قديم');
    const got: number[] = [];
    trackRequest(of(5), busy, error, v => got.push(v));
    expect(got).toEqual([5]); expect(busy()).toBe(false); expect(error()).toBe('');
    trackRequest(throwError(() => ({ status: 400, message: 'مرفوض' })), busy, error, () => got.push(-1));
    expect(got).toEqual([5]); expect(busy()).toBe(false); expect(error()).toBe('مرفوض');
  });
});
