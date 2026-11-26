# EWMS — الواجهة الأمامية

واجهة نظام EWMS (Angular 22، بلا zone.js، كل الصفحات تُحمَّل عند الطلب). البنية والقواعد واللبنات المشتركة في
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — اقرأه قبل إضافة صفحة أو ميزة.

## التشغيل محلياً

يحتاج الباكاند (مستودع EWMS) على `https://localhost:7181`: خادم التطوير يمرّر إليه `/api` و`/hubs` (`proxy.conf.json`).

```bash
npm ci        # تثبيت الحزم كما في package-lock.json
npm start     # خادم التطوير على http://localhost:4200
```

## الأوامر

| الأمر | ما يفعله |
|---|---|
| `npm run verify` | **قبل أي commit**: lint ثم فحص دورات الاستيراد والتصديرات الميتة والألوان الخام ثم اختبارات الوحدة ثم البناء |
| `npm test` | اختبارات الوحدة (Vitest) |
| `npm run build` | البناء الإنتاجي في `dist/` (مع ميزانية حجم الحزمة الأولى) |
| `npm run lint` | ESLint مع حدود الطبقات بين `core` و`shared` و`features` |
| `npm run e2e` | Playwright — يحتاج الباكاند وخادم الواجهة و`E2E_ADMIN_PASSWORD` (انظر `playwright.config.ts`) |
| `npm run metrics:duplicates` | تقرير الكود المكرر (jscpd) |
| `npm run icons` | يولّد `public/icons.svg` من `scripts/icons/icon-paths.mjs` بعد إضافة أيقونة |
| `npm run fonts:woff2` | يولّد خطوط WOFF2 من ملفات OTF |

## التوثيق

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — الطبقات، اللبنات المشتركة، الأمان (CSP)، الأداء، الاختبارات.
- [docs/TEST-PLAN.ar.md](docs/TEST-PLAN.ar.md) — خطة الاختبار.
- [docs/qa/](docs/qa/) — نتائج جولات الفحص.
