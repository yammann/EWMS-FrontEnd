import { FormControl, FormGroup } from '@angular/forms';
import { passwordChecks, passwordProblem, passwordValidator } from './password';

describe('password rules (mirror of PasswordRules)', () => {
  it('accepts 8+ characters with a letter and a digit', () => {
    expect(passwordProblem('abcdefg1')).toBeNull();
    expect(passwordProblem('كلمةسر123')).toBeNull();
  });

  it('rejects short, letter-less and digit-less passwords', () => {
    expect(passwordProblem('')).toBe('كلمة المرور مطلوبة');
    expect(passwordProblem('abc1')).toContain('8 أحرف');
    expect(passwordProblem('12345678')).toContain('حرفاً');
    expect(passwordProblem('abcdefgh')).toContain('رقماً');
  });

  it('rejects the email or its local part, ignoring case', () => {
    expect(passwordProblem('Ahmad123@x.sy', 'ahmad123@x.sy')).toContain('البريد');
    expect(passwordProblem('AHMAD123', ' ahmad123@x.sy ')).toContain('البريد');
    expect(passwordProblem('ahmad1234', 'ahmad123@x.sy')).toBeNull();
  });

  it('lists each condition', () => {
    expect(passwordChecks('abc').map(c => c.ok)).toEqual([false, true, false]);
    expect(passwordChecks('abcdefg1').every(c => c.ok)).toBe(true);
  });

  it('validator reads the sibling email and allows empty when optional', () => {
    const form = new FormGroup({ email: new FormControl('sami99@x.sy'), password: new FormControl('sami99', passwordValidator()) });
    form.controls.password.setValue('sami9999');
    expect(form.controls.password.errors).toBeNull();
    form.controls.email.setValue('sami9999@x.sy');
    form.controls.password.updateValueAndValidity();
    expect(form.controls.password.errors?.['password']).toContain('البريد');
    expect(passwordValidator(true)(new FormControl(''))).toBeNull();
    expect(passwordValidator()(new FormControl(''))).toEqual({ password: 'كلمة المرور مطلوبة' });
  });
});
