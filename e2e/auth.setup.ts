import { test as setup, expect } from '@playwright/test';

const email = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@system.com';
const password = process.env['E2E_ADMIN_PASSWORD'];

setup('تسجيل الدخول وحفظ الجلسة', async ({ page }) => {
  expect(password, 'عيّن E2E_ADMIN_PASSWORD قبل التشغيل').toBeTruthy();
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password!);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});
