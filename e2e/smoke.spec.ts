import { test, expect } from '@playwright/test';

/** كل صفحة يجب أن تفتح بلا أخطاء كونسول ولا استجابات 5xx، وأن يظهر محتواها الرئيسي. */
const PAGES: [string, string][] = [
  ['الرئيسية', '/'],
  ['الملف الشخصي', '/profile'],
  ['الإشعارات', '/notifications'],
  ['لوحة المهام', '/task-board'],
  ['المهام الدورية', '/task-board/recurring'],
  ['إحصاءات المهام', '/task-board/stats'],
  ['مفكرتي', '/todo-lists'],
  ['تركيبات الأجهزة', '/devices/installations'],
  ['المواقع', '/devices/sites'],
  ['كتالوج الأجهزة', '/devices/catalog'],
  ['طلبات الصيانة', '/maintenance/requests'],
  ['أجهزة الصيانة', '/maintenance/devices'],
  ['قطع الغيار', '/maintenance/parts'],
  ['تقرير القطع', '/maintenance/parts/report'],
  ['مهام الصيانة', '/maintenance/tasks'],
  ['إحصاءات الصيانة', '/maintenance/stats'],
  ['إعدادات الصيانة', '/maintenance/settings'],
  ['مراجعة الإجازات', '/vacations/review'],
  ['إحصاءات الإجازات', '/vacations/stats'],
  ['أنواع الإجازات', '/vacation-types'],
  ['العطل الرسمية', '/vacations/holidays'],
  ['الفروع', '/branches'],
  ['الأقسام', '/departments'],
  ['المكاتب', '/offices'],
  ['المستخدمون', '/users'],
  ['الأدوار', '/roles'],
  ['مهام العمل', '/work-tasks']
];

for (const [name, url] of PAGES) {
  test(`صفحة «${name}» تفتح بلا أخطاء`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

    await page.goto(url);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main.shell').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    // 404 المتوقعة (مثل BySerial) تُسجَّل في الكونسول كأخطاء مورد — نتجاهلها
    const real = errors.filter(e => !/status of 404|status of 403/.test(e));
    expect(real, real.join('\n')).toEqual([]);
  });
}
