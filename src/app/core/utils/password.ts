import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * سياسة كلمة المرور — مطابقة لـ Application/Common/PasswordRules في الباكاند (عدّلهما معاً):
 * 8 أحرف على الأقل، فيها حرف ورقم، ولا تساوي البريد الإلكتروني ولا جزأه الأول. الخادم يفحصها دائماً؛ هنا للتنبيه المبكر.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH} أحرف على الأقل، فيها حرف ورقم`;

/** شروط السياسة واحداً واحداً (لقائمة ✓ تحت الحقل) */
export function passwordChecks(password: string | null | undefined) {
  const value = password ?? '';
  return [
    { label: `${PASSWORD_MIN_LENGTH} أحرف على الأقل`, ok: value.length >= PASSWORD_MIN_LENGTH },
    { label: 'حرف واحد على الأقل', ok: /\p{L}/u.test(value) },
    { label: 'رقم واحد على الأقل', ok: /\p{Nd}/u.test(value) }
  ];
}

/** سبب رفض كلمة المرور بالعربية (نفس رسائل الخادم)، أو null إن كانت مقبولة */
export function passwordProblem(password: string | null | undefined, email?: string | null): string | null {
  const value = password ?? '';
  if (!value) return 'كلمة المرور مطلوبة';
  if (value.length < PASSWORD_MIN_LENGTH) return `كلمة المرور ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  if (!/\p{L}/u.test(value)) return 'كلمة المرور يجب أن تحتوي حرفاً واحداً على الأقل';
  if (!/\p{Nd}/u.test(value)) return 'كلمة المرور يجب أن تحتوي رقماً واحداً على الأقل';
  const address = (email ?? '').trim().toLowerCase();
  const lower = value.toLowerCase();
  if (address && (lower === address || lower === address.split('@')[0]))
    return 'كلمة المرور لا يجوز أن تكون البريد الإلكتروني أو جزأه الأول';
  return null;
}

/**
 * مدقّق نموذج: يقارن بالحقل الشقيق «email» إن وُجد. optional = الحقل الفارغ مقبول (كلمة مرور جديدة عند التعديل).
 * الخطأ { password: '<الرسالة>' }.
 */
export function passwordValidator(optional = false) {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    if (optional && !control.value) return null;
    const problem = passwordProblem(control.value, control.parent?.get('email')?.value);
    return problem ? { password: problem } : null;
  };
}
