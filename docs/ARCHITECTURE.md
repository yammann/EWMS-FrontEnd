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
     ├─ pages/<صفحة>/        مجلد لكل صفحة يفتحها الراوتر: <صفحة>.ts و.html و.scss و.spec.ts (والملفات الخاصة بها وحدها)
     ├─ components/          مكوّنات الميزة (نوافذ، لوحات، عناصر)
     ├─ data-access/         خدمات الميزة ونماذجها (HTTP)
     ├─ utils/  styles/      منطق صرف وأنماط خاصة بالميزة (وأي أنماط تشترك فيها عدة صفحات تُوضع في styles/ لا داخل مجلد صفحة)
     └─ index.ts             الواجهة العامة (ما يجوز لميزة أخرى استيراده)
```

**قواعد الاعتماد (يفرضها ESLint كأخطاء — `npm run lint`):**
- `core` لا يستورد من `features` ولا من `shared/ui`.
- `shared` لا يستورد من `features`.
- الميزة لا تستورد ميزة أخرى إلا عبر `@features/<الميزة>` (index.ts)، لا من ملف داخلها.
- لا استيراد نسبي صاعد أكثر من مستوى: استعمل الأسماء المستعارة `@core/*` `@shared/*` `@features/*` `@env/*`. **استثناء صفحات `pages/<صفحة>/`:** يجوز `../../` فقط للوصول إلى مجلدات الميزة نفسها (`components` و`data-access` و`utils` و`styles`)، وما فوق ذلك بالأسماء المستعارة.
- الاستثناء الوحيد: `app.routes.ts` يستورد `*.routes.ts` للميزات.

## اللبنات المشتركة (لا تعِد كتابتها في الصفحات)

| الحاجة | الأداة |
|---|---|
| رأس الصفحة (عنوان صغير/رئيسي/وصف + أزرار) | `<app-page-header eyebrow heading subtitle>` + الأزرار كمحتوى |
| زر الرجوع | **موحّد في الشريط العلوي** (`app-back-button` في `MainLayout`): يظهر للمسار الذي يعلن `data: { back: '/المسار' }` |
| رسالة خطأ / حالة فارغة | `<app-alert [message]>` / `<app-empty-state [panel]>` |
| بطاقة رقم | `<app-stat-tile icon="users" …>` (اسم أيقونة إلزامي) |
| أيقونة | **`<app-icon name="lock" [size] [weight]>`** (`shared/ui/icon.ts`): مجموعة موحّدة خطية 24×24 بأسلوب SF Symbols مرسومة للمشروع، تأخذ لون النص. **لا Emoji ولا SVG مضمّنة في القوالب** — رمز جديد = أيقونة تُضاف في `scripts/icons/icon-paths.mjs` ثم `npm run icons` (يولّد `public/icons.svg` و`shared/ui/icon-names.ts` برقم نسخة). الرسومات في ملف واحد خارج حزمة JavaScript، وكل أيقونة `<use>` لرمز منه. القيم المخزّنة كـ Emoji (أيقونة مهمة العمل، قائمة «مفكرتي»، «آخر الإجراءات») تُعرض بـ `iconFor(قيمة)`. (أيقونات Apple الأصلية لا يجيز ترخيصها الاستعمال في تطبيق ويب.) |
| **زر عملية تنتظر الخادم** (تصدير، بحث، حذف، إرسال، دخول…) | **`<button appAction="download" [busy] busyLabel="جارٍ التصدير…" [disabled]>تصدير Excel</button>`** (`shared/ui/action-button.ts`): يبقى `<button>` أصلياً؛ أيقونة العملية (`ActionKind` في `action-icon.ts`: save, send, upload, download, delete, edit, reactivate, search, login, refresh, cancel) تتحرك أثناء الانتظار، والنص يتبدّل، والزر يتعطّل، و`aria-busy` يُعلن. `[disabled]` يُربط بالمكوّن ويُدمج مع الانشغال. **النمط الوحيد لمؤشر الانشغال**: لا نص «جارٍ…» يدوي في الزر، ولا مؤشر دوّار خاص (حُذف `.button-spinner` و`.spin`). الاستثناء الموثّق: «اختيار ملفات» في مرفقات الدراسات يبقى مفعّلاً أثناء الرفع (طابور يقبل المزيد) فيرسم الأيقونة بنفسه |
| أزرار نافذة النموذج | `<app-form-actions [busy] [disabled] label busyLabel (dismissed)>` — لكل نموذج في نافذة (لا زر إرسال مكتوب يدوياً بمؤشر خاص)؛ ملاحظة قبل الزرين («اختر الجهاز أولاً») تُمرَّر كمحتوى. النص أثناء الانشغال «جارٍ …» بالكسرة والنقطة الثلاثية `…` |
| معاينة مرفق (صورة/PDF) | `<app-file-preview [file] [load]="(id) => blob$" [save]? (closed)>` (`shared/ui/file-preview.ts`): الجلب برمز الدخول، رابط blob: يُحرَّر عند الإغلاق، PDF وحده في iframe. `isPreviewable(contentType)` يحدد ما يُعاين وما يُنزَّل |
| معاملات العنوان (`?a=1&b=2`) | `query(params)` (`core/http/query.ts`): يُسقط الفارغ ويُبقي الصفر؛ `query(params, { dropZero: true })` حيث يعني 0 «الكل» في الفلاتر |
| خلية الاسم في جداول الإدارة (مربع الحرف الأول + الاسم) | `shared/styles/entity-cell.scss` (`.entity-cell` `.entity-avatar` `.entity-details`)؛ الفروق متغيّرات على الجدول: `--entity-min` `--entity-bg` `--entity-fg` `--entity-name-max` |
| تقويم شهري | `<app-month-calendar [events]>` (أحداث لها بداية ونهاية)؛ وتقويم مواعيد تسليم المهام `app-task-calendar` — كلاهما على `shared/styles/calendar-grid.scss` |
| نافذة / تأكيد / تنبيه | `app-modal` / `ConfirmService` / `ToastService` |
| تقسيم الصفحات | `Pagination<T>` + `<app-pager>` |
| **صفحة إدارة (قائمة + إضافة/تعديل/حذف)** | **`CrudPage`** (`shared/ui/crud-page.ts`) — انظر «النمط الموحّد» أدناه |
| أزرار الصف (تعديل/حذف + أزرار إضافية) | `<app-row-actions [canEdit] [canDelete] [deleting] (edit) (remove)>` والأزرار الإضافية كمحتوى |
| تحميل قائمة/صفحة (بحث، فلاتر، ترقيم، إعادة تحميل عند إشعار) | `private latest = latestRequest();` ثم `this.latest(obs, busy, error, next)` — كل تحميل يلغي السابق، فلا يستبدل ردٌّ متأخر على شبكة بطيئة النتيجةَ الأحدث |
| تحديث الصفحة عند وصول إشعار | إعادة تحميل كل البيانات مع أي إشعار (اللوحات، إحصائيات الإجازات): `NotificationService.changes$` — دفعة الإشعارات المتتابعة = تحميل واحد بعد هدوئها (`RELOAD_QUIET_MS`). تحديث سجل بعينه أو تصفية بنوع الإشعار: `incoming$` الفوري |
| عملية مفردة (حفظ، حذف، إرسال) | `trackRequest(obs, busy, error, next)` — لا تُلغى؛ ورسالة الخطأ `errorMessage(e, بديل)` |
| فحص حيّ أثناء الكتابة (`switchMap`) | `catchError` **داخل** الطلب الداخلي: خطأ يصل للتدفق الخارجي يُنهيه ويتوقف الفحص حتى إعادة فتح الصفحة |
| قائمة اختيار | `<app-select>` (`shared/ui/search-select.ts`) بدل `<select>`: بحث ولوحة مفاتيح، ويعمل مع `formControlName` و`[formControl]` و`ngModel` و`[value]` (يطبّق القيمة بعد وصول الخيارات). لا `<select>` أصلي في القوالب |
| قوائم الهيكل (فروع/أقسام/مكاتب/أدوار) | `LookupsService` (تخزين 60 ث، يُبطَل بعد أي تعديل؛ `branchOptions()` لمن لا يملك ViewBranches) |
| تنسيق تاريخ UTC / مبلغ / كمية | أنابيب `utc` `money` `qty` (`shared/pipes/format.pipes.ts`) أو `core/utils/format.ts` |
| تنزيل ملف من الخادم | `api.getBlob` / `api.postBlob` ثم `saveBlob(blob, اسم)` (`core/utils/download.ts`)؛ رسالة الخطأ العربية تُقرأ من Blob في `apiErrorInterceptor` |
| ترويسة المطبوعات (اسم الدولة) | `PRINT_HEADER` (`core/constants/print.ts`) — نموذج الإجازة وطباعة التقارير |
| تقرير جديد في «مركز التقارير» | صنف في الباكاند فقط (`Infrastructure/Reports`) + صلاحيته في `access.ts` (`REPORT_ACCESS`) وصفحة الأدوار: الواجهة تبني الفلاتر والمعاينة والطباعة من تعريفه |

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
- فشل التحميل: `app-alert` مع «إعادة المحاولة» (`(retry)="crud.refresh()"`) والقائمة السابقة تبقى ظاهرة — **إلزامي في كل صفحة**، والحالة الفارغة لا تظهر مع الخطأ (`@else if (!crud.loadError())`)؛ وإلا بدت الصفحة بلا بيانات.
- القوائم المساعدة للنموذج (أقسام، مكاتب، أدوار…) مع القائمة الأساسية في `forkJoin`: كل واحدة عبر `orEmpty(…)` (`core/http/or-empty.ts`)، فرفضها (نقص صلاحية عرضها) لا يُفشل الصفحة؛ النموذج يقول ما ينقص، والتعديل يُبقي قيمة السجل الحالية خياراً.
- الصفحات ذات الترقيم من الخادم (أجهزة الصيانة، قطع الغيار، مهام الصيانة، التركيبات) تبقى بمنطقها، وتستعمل `app-row-actions` و`deletingId` فقط.
- أُزيلت: `ModalCrud`، `PageActions`، `loader()`.

### أخطاء الـ API
`apiErrorInterceptor` يحوّل كل خطأ لـ `/api/*` إلى `{ status, message }` (الرسالة عربية جاهزة للعرض). لا تفكّ `HttpErrorResponse` في الصفحات.
`jwtInterceptor` يسجّل الخروج عند 401. ترتيبهما في `app.config.ts`: `[jwt, apiError]`.

### الأمان (CSP، 2026-10-13)
الخادم وNginx يرسلان `Content-Security-Policy` (`API/Middlewares/SecurityHeadersMiddleware.cs` في الباكاند): `script-src 'self'`
(**لا سكربت مضمّن**: تهيئة المظهر في `public/theme-init.js`، والبناء الإنتاجي بـ `inlineCritical: false` لأن تضمين CSS الحرج
يضيف `onload` مضمّناً)، الأنماط المضمّنة مسموحة، الصور `data:`/`blob:`، معاينة PDF من `blob:`، والاتصال بالأصل نفسه فقط
(فلا `fetch` لروابط `data:` ولا أي مكتبة أو خط من CDN). بعد أي تغيير من هذا النوع: ابنِ واعرض النسخة الإنتاجية مع الترويسة
وتأكد أن الكونسول بلا «Refused to …».
سياسة كلمة المرور في `core/utils/password.ts` (مطابقة لـ `PasswordRules` في الباكاند): `passwordValidator` لحقول النماذج، و`passwordChecks` لقائمة الشروط.

### الأداء
- كل صفحة `loadComponent`، والإطار `MainLayout` كذلك (`app.routes.ts`): صفحة الدخول والطباعة لا تحمّله، والراوتر يجلبه مع الصفحة بالتوازي؛ التحميل المسبق في الخلفية للصفحات المسموحة فقط (`PermissionPreloadStrategy`، بعد 1.5 ث من التنقل؛ `data.noPreload` لصفحات الطباعة).
- `@defer` للمكوّنات الثقيلة التي تُفتح عند الطلب (الدرج، نوافذ المهام، التقويم، لوحة التوقيع).
- SignalR يُحمَّل بـ `import()` عند بدء الاتصال (خارج الحزمة الأولى).
- ميزانية الحزمة الأولى: تحذير 430 kB / خطأ 480 kB. **2026-10-14: 412 kB** بعد نقل الأيقونات إلى `public/icons.svg`، والشعار إلى قناع CSS من `public/brand/logo.svg` (`shared/ui/logo.ts`)، وتأجيل قائمة المظهر ونوافذ الإشعارات المنبثقة بـ `@defer (on idle)` في `main-layout.html`. إطار Angular نفسه ≈ 355 kB منها. **2026-11-25: 377.74 kB** (كانت 433.6 بعد Angular 22.3 فتجاوزت التحذير) بجعل `MainLayout` كسولاً — خرج منها الإطار (~45 kB) وما لا يستعمله غيره. قِس قبل أي إضافة كبيرة: `ng build --stats-json` ثم حلّل `dist/EWMS.Client/browser-stats.json` (metafile لـ esbuild: `outputs[main].inputs`).
- الخطوط WOFF2 (`npm run fonts:woff2` يولّدها من OTF، تحقق جدولاً بجدول؛ OTF يبقى احتياطاً في `@font-face`): 168 → 85 kB.
- **OnPush**: هو الافتراضي في Angular 22 لكل المكوّنات (لا يوجد `Eager` في المشروع). أي حالة تُعرض في القالب وتتغيّر بعد طلب/مؤقّت يجب أن تكون إشارة.
- أنماط `shared/styles/*.scss` تبقى في المكوّنات (تُضمَّن في كل قطعة كسولة ~2 kB) عمداً: نقلها عاماً لا يسرّع أي صفحة ويجعل محدّدات مثل `dl` و`.panel` و`.actions` تسري على التطبيق كله.

## كيف أضيف…

**صفحة جديدة:** مجلد `features/<ميزة>/pages/<صفحة>/` فيه ملف الصفحة (`<صفحة>.ts`، ومعه `.html` و`.scss` إن وُجدا)، ثم مسار في `<ميزة>.routes.ts` بـ `canActivate: [permissionGuard]` و`data.permission`/`anyPermission` (ومعها `back` إن كانت فرعية). أضف رابطها في `sections` داخل `main-layout.ts`.

**ميزة جديدة:** مجلد بنفس البنية، `<ميزة>.routes.ts` يُضاف إلى `app.routes.ts`، و`index.ts` بما تُصدّره لغيرها فقط.

**استعمال شيء من ميزة أخرى:** صدّره من `index.ts` تلك الميزة ثم `import { X } from '@features/<ميزة>'`.

## الاختبارات
- `npm test` — vitest (وحدة، 385 اختباراً في 70 ملفاً — 2026-11-25): خدمات، pagination، CrudPage، trackRequest، LookupsService، interceptor، `query`، `changes$`، المكوّنات المشتركة (منها `FilePreview` و`FormActions` و`ActionButton`)، **عقود الـ API** (الدراسات، الصيانة — مطابقة لمتحكّمات الباكاند — واللوحات)، والميزات التي كانت بلا اختبارات: الصيانة (نافذة الطلب، قطع الغيار، المهام الميدانية، المسارات)، اللوحات (اختيار اللوحة، لوحتي/لوحة وحدة، التحديث المجمّع)، الملف الشخصي (كلمة المرور، التوقيع وهندسة حبره)، الدخول، **حارس ربط المخرجات** (`template-outputs.spec.ts`: ربط `(event)` على مكوّن لا يملك هذا المخرج يصير مستمع DOM صامتاً بلا خطأ بناء).
- `npm run lint` — ESLint (typescript-eslint + angular-eslint + حدود الطبقات).
- **`npm run verify` — كل الفحوص بأمر واحد قبل أي commit:** lint ثم `check:cycles` (دورات الاستيراد) ثم `check:unused` (تصديرات ماتت بعد تعديل) ثم `check:colors` (ألوان خام خارج رموز التصميم؛ التعليق `raw-color-ok` لبيانات لون مقصودة) ثم الاختبارات ثم البناء.
- اختبارات العقد داخل الواجهة: `permission-sections.spec.ts` (كل صلاحية في AppPermission تقع في مجموعة من صفحة الأدوار، لا اسم مجهول ولا تكرار).
- `npm run e2e` — Playwright بـ Chrome المثبّت: يحتاج API على 7181 وخادم الواجهة و`E2E_ADMIN_PASSWORD` (لا تُحفظ في الشيفرة)؛ `E2E_BASE_URL` لتغيير العنوان (الافتراضي 4200).
  - `smoke.spec.ts`: 27 صفحة بلا أخطاء كونسول/5xx. `flows.spec.ts`: تدفقات (مفكرتي، الفروع، الأدوار، الرجوع، النوافذ).
  - `crud.spec.ts`: إضافة/تعديل/حذف وأخطاء الخادم لكل صفحات الإدارة (أنواع الإجازات، العطل، مهام العمل، الكتالوج، المواقع، إعدادات الصيانة، الهيكل، المستخدمون، الأدوار، أجهزة الصيانة، قطع الغيار). كل سجل باسم «e2e …»، و`cleanup.teardown.ts` يحذف ما تبقّى بعد كل تشغيل.
  - `visual-parity.spec.ts`: تطابق الشكل مع لقطات مرجعية (راجع تعليق الملف لتوليد المرجع من الكود الأصلي).
- الاختبارات التي تحتاج الباكاند الحي تُشغَّل يدوياً؛ الباقي بلا خادم.

## سكربتات (scripts/)
فحوص: `check-cycles` و`check-unused` و`check-colors`. توليد: `build-icons` (الأيقونات) و`fonts-woff2` و`prepare-stamps` (الأختام). أدوات عامة لإعادة الهيكلة: `codemod-move` (نقل رموز بين الملفات مع تعديل الاستيرادات) و`codemod-aliases` (استيرادات نسبية → مسارات مستعارة) و`fix-unused-imports`. (حُذفت سكربتات `phase*` التي كانت لإعادة الهيكلة الأولى 2026-10: بقيت في تاريخ Git.) سكربتات الفحص تبني مساراتها بـ `fileURLToPath` (لا `URL.pathname` المرمَّز) لتعمل في مجلد اسمه عربي أو فيه مسافة.

**محذوف ومحفوظ في Git:** نموذج الخريطة ثلاثية الأبعاد (`docs/prototypes/`، حُذف 2026-11-25 — آخر نسخة في الالتزام `a9fc84c`، والمكوّنات المدمجة في `929136b`): `git show a9fc84c:docs/prototypes/map-3d.html > map-3d.html`. تحذير: heredoc الـ bash يلتهم الشرطات المائلة العكسية — اكتب السكربتات المعتمدة على regex بأداة الكتابة لا بـ `cat <<EOF`.
