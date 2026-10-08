# معمارية الواجهة (Angular 22)

> أُعيدت هيكلة الواجهة على الفرع `refactor/frontend` (2026-10-08) دون أي تغيير في الشكل أو السلوك أو عقد الـ API.
> التحقق: بناء + 100 اختبار وحدة + 59 اختبار Playwright (منها 21 صفحة تُقارَن لقطاتها بالكود الأصلي بعتبة 0.4%).

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
| تحميل صفحة (loading/error/data) | `loader(() => obs, initial, {onLoaded, onError})` أو `trackRequest(obs, loading, error, next)` |
| صفحة إدارة بنافذة إنشاء/تعديل/حذف | `ModalCrud` (مثال: `features/branches/pages/branches-page.ts`) |
| إجراءات حفظ/حذف بمفتاح انشغال وتنبيه | `PageActions` |
| قوائم الهيكل (فروع/أقسام/مكاتب/أدوار) | `LookupsService` (تخزين 60 ث، يُبطَل بعد أي تعديل؛ `branchOptions()` لمن لا يملك ViewBranches) |
| تنسيق تاريخ UTC / مبلغ / كمية | أنابيب `utc` `money` `qty` (`shared/pipes/format.pipes.ts`) أو `core/utils/format.ts` |

### أخطاء الـ API
`apiErrorInterceptor` يحوّل كل خطأ لـ `/api/*` إلى `{ status, message }` (الرسالة عربية جاهزة للعرض). لا تفكّ `HttpErrorResponse` في الصفحات.
`jwtInterceptor` يسجّل الخروج عند 401. ترتيبهما في `app.config.ts`: `[jwt, apiError]`.

### الأداء
- كل صفحة `loadComponent`؛ التحميل المسبق في الخلفية للصفحات المسموحة فقط (`PermissionPreloadStrategy`، بعد 1.5 ث من التنقل؛ `data.noPreload` لصفحات الطباعة).
- `@defer` للمكوّنات الثقيلة التي تُفتح عند الطلب (الدرج، نوافذ المهام، التقويم، لوحة التوقيع).
- SignalR يُحمَّل بـ `import()` عند بدء الاتصال (خارج الحزمة الأولى).
- ميزانية الحزمة الأولى: تحذير 430 kB / خطأ 480 kB.

## كيف أضيف…

**صفحة جديدة:** ملف في `features/<ميزة>/pages/`، ثم مسار في `<ميزة>.routes.ts` بـ `canActivate: [permissionGuard]` و`data.permission`/`anyPermission` (ومعها `back` إن كانت فرعية). أضف رابطها في `sections` داخل `main-layout.ts`.

**ميزة جديدة:** مجلد بنفس البنية، `<ميزة>.routes.ts` يُضاف إلى `app.routes.ts`، و`index.ts` بما تُصدّره لغيرها فقط.

**استعمال شيء من ميزة أخرى:** صدّره من `index.ts` تلك الميزة ثم `import { X } from '@features/<ميزة>'`.

## الاختبارات
- `npm test` — vitest (وحدة): خدمات، pagination، ModalCrud، loader، LookupsService، interceptor، المكوّنات المشتركة، **حارس ربط المخرجات** (`template-outputs.spec.ts`: ربط `(event)` على مكوّن لا يملك هذا المخرج يصير مستمع DOM صامتاً بلا خطأ بناء).
- `npm run lint` — ESLint (typescript-eslint + angular-eslint + حدود الطبقات).
- `npm run e2e` — Playwright بـ Chrome المثبّت: يحتاج API على 7181 وخادم الواجهة و`E2E_ADMIN_PASSWORD` (لا تُحفظ في الشيفرة)؛ `E2E_BASE_URL` لتغيير العنوان (الافتراضي 4200).
  - `smoke.spec.ts`: 27 صفحة بلا أخطاء كونسول/5xx. `flows.spec.ts`: تدفقات (مفكرتي، الفروع، الأدوار، الرجوع، النوافذ).
  - `visual-parity.spec.ts`: تطابق الشكل مع لقطات مرجعية (راجع تعليق الملف لتوليد المرجع من الكود الأصلي).
- الاختبارات التي تحتاج الباكاند الحي تُشغَّل يدوياً؛ الباقي بلا خادم.

## أدوات الترحيل (scripts/)
سكربتات node استُعملت في إعادة الهيكلة وتبقى مرجعاً (`phase*-*.mjs`): نقل الملفات وإعادة كتابة الاستيرادات وتوليد `index.ts` (`phase3-restructure.mjs`)، وتوحيد الأنماط المكرَّرة (alert/empty-state/page-header/form-actions/trackRequest/…). تحذير: heredoc الـ bash يلتهم الشرطات المائلة العكسية — اكتب السكربتات المعتمدة على regex بأداة الكتابة لا بـ `cat <<EOF`.
