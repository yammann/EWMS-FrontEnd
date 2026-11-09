/**
 * فرع الدراسات المركزية — نسخة من DTOs الباكاند (CentralStudiesRequestDtos.cs وCentralStudiesResponseDtos.cs) وتعداداته
 * (Domain/Entities/CentralStudiesBranch/StudyEnums.cs). الأسماء العربية مطابقة لـ StudyRules.Name، والمخرجات
 * تحمل اسم كل قيمة (…Name) فلا تُترجم في الواجهة إلا قوائم الاختيار في النماذج والفلاتر.
 * أعلام Can… يحسبها الخادم لصلاحيات المستخدم وحالة السجل: الواجهة تعرض الأزرار بحسبها ولا تعيد حساب القواعد.
 * التواريخ نصوص ISO؛ تُرسل بصيغة yyyy-MM-dd. rowVersion نص Base64 يُعاد كما جاء عند الحفظ.
 */

export * from './models/enums.models';
export * from './models/lookups.models';
export * from './models/chain.models';
export * from './models/documents.models';
export * from './models/projects.models';
export * from './models/drawings.models';
export * from './models/records.models';
export * from './models/print.models';
