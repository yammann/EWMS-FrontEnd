# معمارية الواجهة (Angular 22)

> أُعيدت هيكلة الواجهة على الفرع `refactor/frontend` (2026-10-08) دون أي تغيير في الشكل أو السلوك أو عقد الـ API.
> المرحلة 8 (2026-10-10): توحيد نمط صفحات الإدارة (`CrudPage`) — تغيّر الشكل قليلاً بقصد (النماذج في نافذة)، والوظيفة محميّة باختبارات `crud.spec.ts`.
> التحقق: بناء + 100 اختبار وحدة + 80 اختبار Playwright (منها 21 صفحة ونوافذ الهيكل تُقارَن لقطاتها بعتبة 0.4%).

## الطبقات والاعتماد

```
src/app/
├─ app.{ts,config.ts,routes.ts}   الإقلاع؛ app.routes.ts يجمع مسارات الميزات فقط
├─ core/        بنية تحتية بلا واجهة: خدمات (auth, api, lookups, notification, theme, nav-history)،
│               guards، interceptors، routing، models مشتركة، utils، constants/access.ts (مرآة الصلاحيات)
├─ shared/      واجهة قابلة لإعادة الاستعمال: ui/ (مكوّنات)، pipes/، styles/ (SCSS مشترك)
└─ features/<الميزة>/
     ├─ <الميزة>.routes.ts   مسارات الميزة (loadComponent لكل صفحة)
     ├─ pages/               المكوّنات التي يفتحها الراوتر
     ├─ components/          مكوّنات الميزة (نوافذ، لوحات، عناصر)
     ├─ data-access/         خدمات الميزة ونماذجها (HTTP)
     ├─ utils/  styles/      منطق صرف وأنماط خاصة بالميزة
     └─ index.ts             الواجهة العامة (ما يجوز لميزة أخرى استيراده)
```

**قواعد الاعتماد (يفرضها ESLint كأخطاء — `npm run lint`):**
- `core` لا يستورد من `features` ولا من `shared/ui`.
- `shared` لا يستورد من `features`.
- الميزة لا تستورد ميزة أخرى إلا عبر `@features/<الميزة>` (index.ts)، لا من ملف داخلها.
- لا استيراد نسبي صاعد أكثر من مستوى: استعمل الأسماء المستعارة `@core/*` `@shared/*` `@features/*` `@env/*`.
- الاستثناء الوحيد: `app.routes.ts` يستورد `*.routes.ts` للميزات.

## اللبنات المشتركة (لا تعِد كتابتها في الصفحات)

| الحاجة | الأداة |
|---|---|
| رأس الصفحة (عنوان صغير/رئيسي/وصف + أزرار) | `<app-page-header eyebrow heading subtitle>` + الأزرار كمحتوى |
| زر الرجوع | **موحّد في الشريط العلوي** (`app-back-button` في `MainLayout`): يظهر للمسار الذي يعلن `data: { back: '/المسار' }` |
| رسالة خطأ / حالة فارغة | `<app-alert [message]>` / `<app-empty-state [panel]>` |
| بطاقة رقم | `<app-stat-tile>` |
| أزرار نافذة النموذج | `<app-form-actions [busy] [disabled] label busyLabel (dismissed)>` |
| نافذة / تأكيد / تنبيه | `app-modal` / `ConfirmService` / `ToastService` |
| تقسيم الصفحات | `Pagination<T>` + `<app-pager>` |
| **صفحة إدارة (قائمة + إضافة/تعديل/حذف)** | **`CrudPage`** (`shared/ui/crud-page.ts`) — انظر «النمط الموحّد» أدناه |
| أزرار الصف (تعديل/حذف + أزرار إضافية) | `<app-row-actions [canEdit] [canDelete] [deleting] (edit) (remove)>` والأزرار الإضافية كمحتوى |
| تحميل قائمة/صفحة (بحث، فلاتر، ترقيم، إعادة تحميل عند إشعار) | `private latest = latestRequest();` ثم `this.latest(obs, busy, error, next)` — كل تحميل يلغي السابق، فلا يستبدل ردٌّ متأخر على شبكة بطيئة النتيجةَ الأحدث |
| عملية مفردة (حفظ، حذف، إرسال) | `trackRequest(obs, busy, error, next)` — لا تُلغى؛ ورسالة الخطأ `errorMessage(e, بديل)` |
| فحص حيّ أثناء الكتابة (`switchMap`) | `catchError` **داخل** الطلب الداخلي: خطأ يصل للتدفق الخارجي يُنهيه ويتوقف الفحص حتى إعادة فتح الصفحة |
| قيمة `<select>` مربوطة بإشارة | `[appSelectValue]` (لا `[value]` على select: يُطبَّق قبل وصول الخيارات فيظهر خيار خاطئ) |
| قوائم الهيكل (فروع/أقسام/مكاتب/أدوار) | `LookupsService` (تخزين 60 ث، يُبطَل بعد أي تعديل؛ `branchOptions()` لمن لا يملك ViewBranches) |
| تنسيق تاريخ UTC / مبلغ / كمية | أنابيب `utc` `money` `qty` (`shared/pipes/format.pipes.ts`) أو `core/utils/format.ts` |

### النمط الموحّد لصفحات الإدارة (CrudPage)
```ts
crud = new CrudPage<Item, Body>({
  load: () => this.service.getAll(),            // أو forkJoin(...).pipe(map(...)) مع قوائم النموذج
  create: body => this.service.create(body), update: (id, body) => this.service.update(id, body),
  remove: item => this.service.delete(item.id),
  can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
  onOpen: item => /* تعبئة النموذج أو تصفيره */, onRefresh: () => this.lookups.invalidate(),
  messages: { saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'الأنواع', confirmDelete: i => `حذف "${i.name}"؟` }
});
```
- **الإضافة والتعديل في نافذة** (`crud.dialog()` = `{mode, item}`)، و**خطأ الخادم داخل النافذة** (`crud.formError()` عبر `app-alert` أو `app-entity-form [error]`) فلا يضيع ما كتبه المستخدم؛ لا تُغلق النافذة أثناء الحفظ.
- النجاح: تُغلق النافذة + تنبيه + **إعادة قراءة صامتة** للقائمة وحدها (الجدول لا يختفي؛ القوائم المساعدة من `LookupsService` لا تُعاد).
- الحذف: `ConfirmService` ثم إزالة الصف محلياً **بلا إعادة قراءة**، ومؤشر على الصف (`crud.deletingId()`).
- فشل التحميل: `app-alert` مع «إعادة المحاولة» (`(retry)="crud.refresh()"`) والقائمة السابقة تبقى ظاهرة.
- الصفحات ذات الترقيم من الخادم (أجهزة الصيانة، قطع الغيار، مهام الصيانة، التركيبات) تبقى بمنطقها، وتستعمل `app-row-actions` و`deletingId` فقط.
- أُزيلت: `ModalCrud`، `PageActions`، `loader()`.

### أخطاء الـ API
`apiErrorInterceptor` يحوّل كل خطأ لـ `/api/*` إلى `{ status, message }` (الرسالة عربية جاهزة للعرض). لا تفكّ `HttpErrorResponse` في الصفحات.
`jwtInterceptor` يسجّل الخروج عند 401. ترتيبهما في `app.config.ts`: `[jwt, apiError]`.

### الأداء
- كل صفحة `loadComponent`؛ التحميل المسبق في الخلفية للصفحات المسموحة فقط (`PermissionPreloadStrategy`، بعد 1.5 ث من التنقل؛ `data.noPreload` لصفحات الطباعة).
- `@defer` للمكوّنات الثقيلة التي تُفتح عند الطلب (الدرج، نوافذ المهام، التقويم، لوحة التوقيع).
- SignalR يُحمَّل بـ `import()` عند بدء الاتصال (خارج الحزمة الأولى).
- ميزانية الحزمة الأولى: تحذير 430 kB / خطأ 480 kB.
- الخطوط WOFF2 (`npm run fonts:woff2` يولّدها من OTF، تحقق جدولاً بجدول؛ OTF يبقى احتياطاً في `@font-face`): 168 → 85 kB.
- **OnPush**: هو الافتراضي في Angular 22 لكل المكوّنات (لا يوجد `Eager` في المشروع). أي حالة تُعرض في القالب وتتغيّر بعد طلب/مؤقّت يجب أن تكون إشارة.
- أنماط `shared/styles/*.scss` تبقى في المكوّنات (تُضمَّن في كل قطعة كسولة ~2 kB) عمداً: نقلها عاماً لا يسرّع أي صفحة ويجعل محدّدات مثل `dl` و`.panel` و`.actions` تسري على التطبيق كله.

## كيف أضيف…

**صفحة جديدة:** ملف في `features/<ميزة>/pages/`، ثم مسار في `<ميزة>.routes.ts` بـ `canActivate: [permissionGuard]` و`data.permission`/`anyPermission` (ومعها `back` إن كانت فرعية). أضف رابطها في `sections` داخل `main-layout.ts`.

**ميزة جديدة:** مجلد بنفس البنية، `<ميزة>.routes.ts` يُضاف إلى `app.routes.ts`، و`index.ts` بما تُصدّره لغيرها فقط.

**استعمال شيء من ميزة أخرى:** صدّره من `index.ts` تلك الميزة ثم `import { X } from '@features/<ميزة>'`.

## الاختبارات
- `npm test` — vitest (وحدة): خدمات، pagination، CrudPage، SelectValue، trackRequest، LookupsService، interceptor، المكوّنات المشتركة، **حارس ربط المخرجات** (`template-outputs.spec.ts`: ربط `(event)` على مكوّن لا يملك هذا المخرج يصير مستمع DOM صامتاً بلا خطأ بناء).
- `npm run lint` — ESLint (typescript-eslint + angular-eslint + حدود الطبقات).
- `npm run e2e` — Playwright بـ Chrome المثبّت: يحتاج API على 7181 وخادم الواجهة و`E2E_ADMIN_PASSWORD` (لا تُحفظ في الشيفرة)؛ `E2E_BASE_URL` لتغيير العنوان (الافتراضي 4200).
  - `smoke.spec.ts`: 27 صفحة بلا أخطاء كونسول/5xx. `flows.spec.ts`: تدفقات (مفكرتي، الفروع، الأدوار، الرجوع، النوافذ).
  - `crud.spec.ts`: إضافة/تعديل/حذف وأخطاء الخادم لكل صفحات الإدارة (أنواع الإجازات، العطل، مهام العمل، الكتالوج، المواقع، إعدادات الصيانة، الهيكل، المستخدمون، الأدوار، أجهزة الصيانة، قطع الغيار). كل سجل باسم «e2e …»، و`cleanup.teardown.ts` يحذف ما تبقّى بعد كل تشغيل.
  - `visual-parity.spec.ts`: تطابق الشكل مع لقطات مرجعية (راجع تعليق الملف لتوليد المرجع من الكود الأصلي).
- الاختبارات التي تحتاج الباكاند الحي تُشغَّل يدوياً؛ الباقي بلا خادم.

## أدوات الترحيل (scripts/)
سكربتات node استُعملت في إعادة الهيكلة وتبقى مرجعاً (`phase*-*.mjs`): نقل الملفات وإعادة كتابة الاستيرادات وتوليد `index.ts` (`phase3-restructure.mjs`)، وتوحيد الأنماط المكرَّرة (alert/empty-state/page-header/form-actions/trackRequest/…). تحذير: heredoc الـ bash يلتهم الشرطات المائلة العكسية — اكتب السكربتات المعتمدة على regex بأداة الكتابة لا بـ `cat <<EOF`.
