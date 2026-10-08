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

test.describe('زر الرجوع الموحّد', () => {
  test('يظهر في الشريط العلوي للصفحات الفرعية ويرجع للأب عند الفتح المباشر', async ({ page }) => {
    await page.goto('/task-board/recurring');
    const back = page.locator('.topbar').getByRole('button', { name: 'رجوع' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/task-board$/);
  });

  test('لا يظهر في الصفحات الرئيسية', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'رجوع' })).toHaveCount(0);
  });

  test('يرجع للصفحة السابقة داخل التطبيق', async ({ page }) => {
    await page.goto('/task-board');
    await page.goto('/task-board/stats');
    const link = page.getByRole('link', { name: /الإحصاءات|إحصاءات/ }).first();
    if (await link.count()) {
      await page.goto('/task-board');
      await link.click();
      await expect(page).toHaveURL(/task-board\/stats/);
      await page.locator('.topbar').getByRole('button', { name: 'رجوع' }).click();
      await expect(page).toHaveURL(/\/task-board$/);
    }
  });
});

test('الفروع: إنشاء فرع يظهر فوراً (إبطال التخزين المؤقت) ثم حذفه', async ({ page }) => {
  const name = 'فرع اختبار آلي ' + Date.now();
  await page.goto('/branches');
  await page.getByRole('button', { name: /فرع جديد|إنشاء فرع/ }).first().click();
  await page.locator('#create-name').fill(name);
  await page.locator('#create-desc').fill('فرع يُنشئه الاختبار الآلي ثم يحذفه');
  await page.locator('app-modal button[type=submit]').click();
  await expect(page.getByText(name).first()).toBeVisible();

  // الصفحة الأخرى (الأقسام) تقرأ من نفس التخزين: الفرع الجديد يظهر في قائمة الفروع بلا تحديث
  await page.goto('/departments');
  await page.locator('button.new-btn').click();
  await expect(page.locator('#create-branch option', { hasText: name })).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.goto('/branches');
  await expect(page.getByText(name).first()).toBeVisible();
  // أقرب حاوية للاسم تحوي زر الحذف (الجدول قد يكون بطاقات أو صفوفاً)
  const row = page.getByText(name).first().locator('xpath=ancestor::*[.//button[@title="حذف"]][1]');
  await row.locator('button[title="حذف"]').click();
  await page.getByRole('button', { name: /^(حذف|تأكيد|نعم)/ }).last().click();
  await expect(page.getByText(name)).toHaveCount(0);
});
