import { test, expect } from '@playwright/test';

test('مفكرتي: إنشاء قائمة ثم حذفها', async ({ page }) => {
  const name = 'اختبار آلي ' + Date.now();
  await page.goto('/todo-lists');
  await page.getByRole('button', { name: '+ قائمة جديدة' }).click();
  await page.getByPlaceholder('مثال: مهام الأسبوع').fill(name);
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page).toHaveURL(/\/todo-lists\/\d+/);   // بعد الإنشاء تُفتح القائمة الجديدة
  await page.goto('/todo-lists');
  const card = page.getByRole('button', { name: 'فتح القائمة ' + name });
  await expect(card).toBeVisible();

  await page.getByRole('button', { name: 'خيارات ' + name }).click();
  await page.getByRole('menuitem', { name: 'حذف' }).dispatchEvent('click');
  // نافذة التأكيد المشتركة
  await page.getByRole('button', { name: /^(حذف|تأكيد|نعم)/ }).last().click();
  await expect(card).toHaveCount(0);
});

test('الأدوار: البحث يعرض قائمة اقتراحات', async ({ page }) => {
  await page.goto('/roles');
  const search = page.getByRole('combobox', { name: /بحث/ });
  await search.fill('Super');
  await expect(page.getByRole('option').first()).toBeVisible();
});

test('الإشعارات: الصفحة تعرض عناصر التقسيم أو حالة فارغة', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.locator('app-pager, .empty-state').first()).toBeVisible();
});

// جلسة مستقلة: الخروج يُبطل التوكن في الخادم، فلا نستعمل جلسة الاختبارات الأخرى
test.describe('الجلسة', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('الخروج يعيد إلى صفحة الدخول', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(process.env['E2E_ADMIN_EMAIL'] ?? 'admin@system.com');
    await page.getByLabel('كلمة المرور', { exact: true }).fill(process.env['E2E_ADMIN_PASSWORD']!);
    await page.locator('button[type=submit]').click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByRole('button', { name: /خروج|تسجيل الخروج/ }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});
