import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * عدد صحيح: حقل الرقم يقبل كتابة 2.5 رغم step="1" فيُرفض الخادم القيمة برسالة تقنية،
 * فيُمنع هنا قبل الإرسال. الفارغ يمرّ (يُلزمه required إن لزم).
 */
export function integer(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v == null || v === '' || Number.isInteger(Number(v)) ? null : { integer: true };
}
