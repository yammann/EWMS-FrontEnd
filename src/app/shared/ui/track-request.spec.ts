import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { trackRequest } from './track-request';

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
