import { defineConfig, devices } from '@playwright/test';

/**
 * اختبارات التدفقات الرئيسية (شبكة أمان لإعادة الهيكلة).
 * تحتاج: الـ API على https://localhost:7181 و`ng serve` على 4200 (يشغّلهما المستخدم).
 * بيانات الدخول من متغيرات البيئة فقط — لا تُحفظ في الشيفرة:
 *   E2E_ADMIN_EMAIL (افتراضي admin@system.com) و E2E_ADMIN_PASSWORD (مطلوب).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    locale: 'ar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    {
      name: 'chrome',
      // Chrome المثبّت على الجهاز — بلا تنزيل متصفح إضافي
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: 'e2e/.auth/admin.json', viewport: { width: 1440, height: 900 } },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/
    }
  ]
});
