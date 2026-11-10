import { FormControl } from '@angular/forms';
import { integer } from './validators';

describe('integer validator', () => {
  const check = (v: unknown) => integer(new FormControl(v));
  it('accepts whole numbers, empty values and zero', () => {
    expect([check(2), check('7'), check(0), check(null), check('')]).toEqual([null, null, null, null, null]);
  });
  it('rejects fractions', () => {
    expect(check(2.5)).toEqual({ integer: true });
    expect(check('0.2')).toEqual({ integer: true });
  });
});
