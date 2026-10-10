import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { latestRequest, trackRequest } from './track-request';

describe('trackRequest()', () => {
  it('toggles busy, clears error, and reports failure message', async () => {
    const busy = signal(false), error = signal('قديم');
    const got: number[] = [];
    trackRequest(of(5), busy, error, v => got.push(v));
    expect(got).toEqual([5]); expect(busy()).toBe(false); expect(error()).toBe('');
    trackRequest(throwError(() => ({ status: 400, message: 'مرفوض' })), busy, error, () => got.push(-1));
    expect(got).toEqual([5]); expect(busy()).toBe(false); expect(error()).toBe('مرفوض');
  });
});

describe('latestRequest()', () => {
  const create = () => runInInjectionContext(TestBed.inject(Injector), () => latestRequest());

  it('ignores a slow earlier response that arrives after a newer one', () => {
    const latest = create();
    const busy = signal(false), error = signal('');
    const first = new Subject<string>(), second = new Subject<string>();
    const got: string[] = [];
    latest(first, busy, error, v => got.push(v));
    latest(second, busy, error, v => got.push(v));
    second.next('جديد');
    first.next('قديم');           // وصل متأخراً: أُلغي اشتراكه فلا يستبدل النتيجة
    expect(got).toEqual(['جديد']);
    expect(first.observed).toBe(false);
    expect(busy()).toBe(false);
  });

  it('cancels the pending request when the page is destroyed', () => {
    const latest = create();
    const pending = new Subject<number>();
    latest(pending, signal(false), signal(''), () => { /* */ });
    expect(pending.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(pending.observed).toBe(false);
  });
});
