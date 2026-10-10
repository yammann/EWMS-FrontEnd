import { test, expect } from '@playwright/test';

/**
 * تطابق الشكل قبل/بعد إعادة الهيكلة: تُلتقط اللقطات المرجعية من الكود الأصلي ثم تُقارن بالكود الجديد.
 *   1) خادم الكود الأصلي على 4301:  E2E_BASE_URL=http://localhost:4301 npx playwright test visual-parity --update-snapshots
 *   2) الكود الجديد:                E2E_BASE_URL=http://localhost:4300 npx playwright test visual-parity
 * اللقطات لا تُرفع إلى git (e2e/*-snapshots).
 */
const PAGES: [string, string][] = [
  ['home', '/'],
  ['profile', '/profile'],
  ['notifications', '/notifications'],
  ['task-board', '/task-board'],
  ['todo-lists', '/todo-lists'],
  ['installations', '/devices/installations'],
  ['sites', '/devices/sites'],
  ['catalog', '/devices/catalog'],
  ['maint-requests', '/maintenance/requests'],
  ['maint-devices', '/maintenance/devices'],
  ['maint-parts', '/maintenance/parts'],
  ['maint-settings', '/maintenance/settings'],
  ['vac-review', '/vacations/review'],
  ['vac-types', '/vacation-types'],
  ['holidays', '/vacations/holidays'],
  ['branches', '/branches'],
  ['departments', '/departments'],
  ['offices', '/offices'],
  ['users', '/users'],
  ['roles', '/roles'],
  ['work-tasks', '/work-tasks'],
];

for (const [name, url] of PAGES) {
  test(`شكل ${name}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: 'disabled', maxDiffPixelRatio: 0.004,
      // عناصر تتغير بين التشغيلين (أوقات نسبية، شارات عدّاد)
      mask: [page.locator('.badge'), page.locator('time'), page.locator('.ago')],
    });
  });
}

// نوافذ الإنشاء والتعديل في صفحات الإدارة (تُلتقط وهي مفتوحة)
for (const [name, url] of [['branches', '/branches'], ['departments', '/departments'], ['offices', '/offices']] as const) {
  for (const mode of ['create', 'edit'] as const) {
    test(`نافذة ${name} ${mode}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      if (mode === 'create') await page.locator('button.new-btn').click();
      else await page.locator('button.icon-btn.edit').first().click();
      await page.locator('app-modal .modal').first().waitFor();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`modal-${name}-${mode}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.004 });
    });
  }
}
