/**
 * أدوات فحص تطابق نماذج الواجهة المكتوبة يدوياً مع عقد الباكاند (api-types.ts المولَّد من contract/openapi.json).
 * الفحص وقت الترجمة: حقل في نموذج الواجهة غير موجود في الـ DTO (أُعيدت تسميته أو حُذف في الباكاند) أو نوعه لا يطابق
 * ما يرسله الخادم فعلاً يُظهر خطأ ترجمة في ملف الاختبار، فلا يصل إلى المستخدم كحقل فارغ بصمت.
 * الواجهة قد تُعرِّف حقولاً أقل من الـ DTO (لا تحتاجها كلها)، لكن لا تُعرِّف حقلاً غير موجود ولا نوعاً يتعارض.
 * الاستعمال في ملف *.spec.ts: conforms<Conforms<Vacation, VacationResponseDto>>();
 */

/** أسماء الحقول التي تختلف فيها الواجهة عن العقد: غير موجودة في الـ DTO، أو نوع الـ DTO لا يُسند إلى نوع الواجهة */
export type Drift<Ui, Api> = {
  [K in keyof Ui]-?: K extends keyof Api ? ([Api[K]] extends [Ui[K]] ? never : K) : K;
}[keyof Ui];

/** true إن تطابقا، وإلا كائن يحمل أسماء الحقول المختلفة (يظهر في رسالة خطأ الترجمة) */
export type Conforms<Ui, Api> = [Drift<Ui, Api>] extends [never] ? true : { driftingFields: Drift<Ui, Api> };

/** لا يفعل شيئاً وقت التشغيل؛ قيد النوع هو الفحص */
export const conforms = <T extends true>(): T | undefined => undefined;
