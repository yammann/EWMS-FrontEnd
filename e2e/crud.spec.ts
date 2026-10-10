import { test, expect, Page, Locator } from '@playwright/test';

/**
 * اختبارات وظيفية لصفحات الإدارة (إضافة/تعديل/حذف + الميزات الخاصة + ظهور أخطاء الخادم).
 * مكتوبة على مستوى «ما يفعله المستخدم» لا شكل الصفحة: تعمل مع النموذج داخل الصفحة أو في نافذة،
 * ومع تأكيد الحذف بشريط داخلي أو نافذة — كي تبقى حَكَماً قبل توحيد النمط وبعده.
 * كل سجل يُنشأ باسم «e2e …» فريد ويُحذف في نهاية الاختبار.
 */

const uid = () => Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);

// أكبر حجم صفحة متاح، كي تظهر السجلات الجديدة غالباً في الصفحة الأولى (ومع ذلك row() يتنقّل بين الصفحات)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('ewms_page_size', '50'); } catch { /* */ } });
});

/** النافذة المفتوحة إن وُجدت، وإلا الصفحة */
async function scope(page: Page): Promise<Locator> {
  const dialog = page.locator('.modal:not(.confirm-dialog)').last();
  return (await dialog.isVisible()) ? dialog : page.locator('body');
}

/** يبدأ الإنشاء: زر «جديد» إن وُجد (النمط الموحّد)، وإلا فالنموذج ظاهر في الصفحة أصلاً */
async function startCreate(page: Page, button: RegExp) {
  const b = page.locator('main').getByRole('button', { name: button }).first();
  try { await b.waitFor({ state: 'visible', timeout: 5000 }); } catch { return; }   // لا زر: النموذج داخل الصفحة
  await b.click();
}

async function field(page: Page, label: string | RegExp): Promise<Locator> {
  return (await scope(page)).getByLabel(label).first();
}

async function submit(page: Page) {
  await (await scope(page)).locator('button[type=submit]').first().click();
}

function row(page: Page, text: string): Locator {
  return page.locator('tr', { hasText: text });
}

/** ينتظر ظهور صف يحوي النص، متنقّلاً بين صفحات الجدول إن لزم */
async function findRow(page: Page, text: string): Promise<Locator> {
  const r = row(page, text);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await r.count()) return r;
    const next = page.locator('app-pager').getByRole('button', { name: /التالي/ }).first();
    if (await next.count() && await next.isEnabled()) { await next.click(); continue; }
    // العودة للصفحة الأولى ثم الانتظار قليلاً (الجدول قد يكون قيد إعادة القراءة)
    const first = page.locator('app-pager').getByRole('button', { name: /^1$/ }).first();
    if (await first.count()) await first.click();
    await page.waitForTimeout(300);
  }
  return r;
}

/** ينقر «حذف» في صف ثم يؤكّد (شريط داخلي أو نافذة تأكيد) */
async function deleteRow(page: Page, text: string) {
  await (await findRow(page, text)).getByRole('button', { name: /^حذف/ }).first().click();
  const confirmBtn = page.locator('.confirm-dialog button.danger, .alert-warning button.btn-danger').first();
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await expect(row(page, text)).toHaveCount(0);
}

async function editRow(page: Page, text: string) {
  await (await findRow(page, text)).getByRole('button', { name: /^تعديل/ }).first().click();
}

/** يتحقق من ظهور صف (بعد التنقل بين الصفحات) */
async function expectRow(page: Page, text: string, contains?: string) {
  const r = await findRow(page, text);
  if (contains) await expect(r.first()).toContainText(contains);
  else await expect(r.first()).toBeVisible();
  return r;
}

/** ينتظر أن تمتلئ قائمة منسدلة من الخادم (أكثر من خيار الإرشاد) */
async function waitOptions(select: Locator, min = 2) {
  await expect.poll(async () => select.locator('option').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(min);
}

/** رسالة خطأ مرئية (داخل نافذة، أو شريط، أو تنبيه عابر) */
async function expectError(page: Page) {
  await expect(page.locator('[role=alert]').filter({ hasText: /\S/ }).first()).toBeVisible();
}

/** يحدد نقطة الموقع بالبحث عن مكان واختيار أول نتيجة (المحافظة تُحسب من النقطة) */
async function pickPlace(page: Page, query: string) {
  const box = (await scope(page)).getByRole('combobox').first();
  await box.fill(query);
  await (await scope(page)).getByRole('option').first().click();
}

async function closeDialogIfOpen(page: Page) {
  const dialog = page.locator('.modal:not(.confirm-dialog)').last();
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
}

// ───────────────────────── أنواع الإجازات ─────────────────────────
test('أنواع الإجازات: إضافة وتعديل وحذف', async ({ page }) => {
  const name = 'e2e نوع ' + uid(), renamed = name + ' معدّل';
  await page.goto('/vacation-types');
  await startCreate(page, /نوع جديد|نوع إجازة جديد/);
  await (await field(page, 'الاسم')).fill(name);
  await (await field(page, 'الوصف')).fill('وصف تجريبي');
  await (await field(page, 'الدفع')).selectOption({ label: 'نوع غير مدفوع' });
  await submit(page);
  await expectRow(page, name);

  await editRow(page, name);
  await (await field(page, 'الاسم')).fill(renamed);
  await submit(page);
  await expectRow(page, renamed);

  await deleteRow(page, renamed);
});

// خطأ في الباكاند (2026-10-10، بانتظار قرار المستخدم): CreateVacationTypeRequestDto/UpdateVacationTypeRequestDto بلا IsPaid،
// فكل نوع جديد يُحفظ «مدفوعاً» مهما اختار المستخدم، ولا يتغير بالتعديل. يُفعَّل هذا الاختبار بعد إصلاح الـ API.
test.fixme('أنواع الإجازات: نوع الدفع المختار يُحفظ', async ({ page }) => {
  const name = 'e2e نوع ' + uid();
  await page.goto('/vacation-types');
  await startCreate(page, /نوع جديد|نوع إجازة جديد/);
  await (await field(page, 'الاسم')).fill(name);
  await (await field(page, 'الدفع')).selectOption({ label: 'نوع غير مدفوع' });
  await submit(page);
  await expectRow(page, name, 'غير مدفوع');
  await deleteRow(page, name);
});

// ───────────────────────── العطل الرسمية ─────────────────────────
test('العطل: عطلة لعدة أيام تضيف يوماً لكل تاريخ، والتعديل والحذف', async ({ page }) => {
  const year = new Date().getFullYear() + 2;
  const name = 'e2e عطلة ' + uid();
  await page.goto('/vacations/holidays');
  await page.getByRole('combobox', { name: 'السنة' }).selectOption(String(year));
  await startCreate(page, /عطلة جديدة|إضافة عطلة/);
  await (await field(page, 'الاسم')).fill(name);
  await (await field(page, /من تاريخ|^التاريخ/)).fill(`${year}-03-10`);
  await (await field(page, 'إلى تاريخ')).fill(`${year}-03-11`);
  await submit(page);
  await expect(row(page, name)).toHaveCount(2);

  // نهاية قبل البداية: رسالة تحقق ولا حفظ
  await startCreate(page, /عطلة جديدة|إضافة عطلة/);
  await (await field(page, /من تاريخ|^التاريخ/)).fill(`${year}-05-10`);
  await (await field(page, 'إلى تاريخ')).fill(`${year}-05-01`);
  await expect(page.getByText('تاريخ النهاية يجب أن يساوي تاريخ البداية أو يليه.')).toBeVisible();
  await closeDialogIfOpen(page);

  const first = row(page, name).first();
  await first.getByRole('button', { name: /^تعديل/ }).click();
  await (await field(page, 'الاسم')).fill(name + ' أ');
  await submit(page);
  await expect(row(page, name + ' أ')).toHaveCount(1);

  await deleteRow(page, name + ' أ');
  await deleteRow(page, name);
});

// ───────────────────────── مهام العمل ─────────────────────────
test('مهام العمل: إضافة بفرع وموظف مسؤول، تعديل، وحذف؛ والاسم المكرر في نفس الفرع يُرفض', async ({ page }) => {
  const name = 'e2e مهمة ' + uid();
  await page.goto('/work-tasks');
  await startCreate(page, /مهمة جديدة/);
  const branch = await field(page, 'الفرع');
  // أول فرع فيه موظفون (بعد وصول قائمة الفروع)
  await waitOptions(branch);
  const options = await branch.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value).filter(v => v !== '0'));
  let picked = false;
  for (const v of options) {
    await branch.selectOption(v);
    const users = (await scope(page)).locator('.user-option input[type=checkbox]');
    try { await expect(users.first()).toBeVisible({ timeout: 3000 }); } catch { continue; }
    await users.first().check();
    picked = true; break;
  }
  expect(picked, 'يلزم فرع فيه موظفون').toBe(true);
  await (await field(page, 'اسم المهمة')).fill(name);
  await submit(page);
  await expectRow(page, name);
  await expect(row(page, name).locator('td').nth(3)).not.toHaveText('—');

  // الاسم نفسه في نفس الفرع: خطأ ظاهر
  const branchName = (await row(page, name).locator('td').nth(1).innerText()).trim();
  await startCreate(page, /مهمة جديدة/);
  await (await field(page, 'اسم المهمة')).fill(name);
  await (await field(page, 'الفرع')).selectOption({ label: branchName });
  await submit(page);
  await expectError(page);
  await closeDialogIfOpen(page);

  await editRow(page, name);
  await (await field(page, 'اسم المهمة')).fill(name + ' م');
  await submit(page);
  await expectRow(page, name + ' م');
  await deleteRow(page, name + ' م');
});

// ───────────────────────── كتالوج الأجهزة ─────────────────────────
test('كتالوج الأجهزة: إضافة وتعديل وحذف، والاسم+الموديل المكرر يُرفض مع بقاء النموذج', async ({ page }) => {
  const name = 'e2e جهاز ' + uid();
  await page.goto('/devices/catalog');
  await startCreate(page, /جهاز جديد/);
  await (await field(page, 'اسم الجهاز')).fill(name);
  await (await field(page, 'الموديل')).fill('M1');
  await submit(page);
  await expectRow(page, name);

  await startCreate(page, /جهاز جديد/);
  await (await field(page, 'اسم الجهاز')).fill(name);
  await (await field(page, 'الموديل')).fill('M1');
  await submit(page);
  await expectError(page);
  await expect(await field(page, 'اسم الجهاز')).toHaveValue(name);       // لم يضع ما أدخله المستخدم
  await closeDialogIfOpen(page);

  await editRow(page, name);
  await (await field(page, 'الموديل')).fill('M2');
  await submit(page);
  await expectRow(page, name, 'M2');
  await deleteRow(page, name);
});

// ───────────────────────── المواقع ─────────────────────────
test('المواقع: إضافة بإحداثيات (المحافظة من الخادم)، تعديل، حذف، والاسم المكرر يُرفض', async ({ page }) => {
  const name = 'e2e موقع ' + uid();
  await page.goto('/devices/sites');
  await startCreate(page, /موقع جديد/);
  await (await field(page, 'اسم الموقع')).fill(name);
  await pickPlace(page, 'المزة');
  await submit(page);
  await expectRow(page, name, 'دمشق');

  await startCreate(page, /موقع جديد/);
  await (await field(page, 'اسم الموقع')).fill(name);
  await pickPlace(page, 'المزة');
  await submit(page);
  await expectError(page);
  await closeDialogIfOpen(page);

  await editRow(page, name);
  await (await field(page, 'مسؤول الموقع')).fill('مسؤول تجريبي');
  await submit(page);
  await expectRow(page, name);
  await deleteRow(page, name);
});

// ───────────────────────── إعدادات الصيانة ─────────────────────────
test('إعدادات الصيانة: نوع عطل إضافة وتعديل وحذف، وحالة بمرحلة ولون', async ({ page }) => {
  const name = 'e2e عطل ' + uid();
  await page.goto('/maintenance/settings?tab=damageTypes');
  await startCreate(page, /^\+ /);
  await (await field(page, 'الاسم')).fill(name);
  await submit(page);
  await expectRow(page, name);
  await editRow(page, name);
  await (await field(page, 'الاسم')).fill(name + ' ب');
  await submit(page);
  await expectRow(page, name + ' ب');
  await deleteRow(page, name + ' ب');

  const status = 'e2e حالة ' + uid();
  await page.goto('/maintenance/settings?tab=statuses');
  await startCreate(page, /^\+ /);
  await (await field(page, 'الاسم')).fill(status);
  await (await field(page, 'المرحلة')).selectOption({ index: 2 });
  await submit(page);
  await expectRow(page, status);
  await deleteRow(page, status);
});

// ───────────────────────── الفروع / الأقسام / المكاتب ─────────────────────────
test('الهيكل: فرع ← قسم ← مكتب (إضافة وتعديل)، ثم حذف بالعكس؛ واسم مكتب مكرر يُرفض', async ({ page }) => {
  const id = uid();
  const branch = 'e2e فرع ' + id, dept = 'e2e قسم ' + id, office = 'e2e مكتب ' + id;

  await page.goto('/branches');
  await startCreate(page, /فرع جديد/);
  await (await field(page, 'اسم الفرع')).fill(branch);
  await (await field(page, 'الوصف')).fill('فرع تجريبي');
  await submit(page);
  await expectRow(page, branch);
  await editRow(page, branch);
  await (await field(page, 'الوصف')).fill('وصف معدّل');
  await submit(page);
  await expectRow(page, branch, 'وصف معدّل');

  await page.goto('/departments');
  await startCreate(page, /قسم جديد/);
  await (await field(page, 'اسم القسم')).fill(dept);
  await (await field(page, 'الوصف')).fill('قسم تجريبي');
  await (await field(page, /^الفرع/)).selectOption({ label: branch });
  await submit(page);
  await expectRow(page, dept, branch);

  await page.goto('/offices');
  await startCreate(page, /مكتب جديد/);
  await (await field(page, 'اسم المكتب')).fill(office);
  await (await field(page, /^القسم/)).selectOption({ label: `${branch} / ${dept}` });
  await (await field(page, 'الوصف')).fill('مكتب تجريبي');
  await submit(page);
  await expectRow(page, office);

  await startCreate(page, /مكتب جديد/);
  await (await field(page, 'اسم المكتب')).fill(office);
  await (await field(page, /^القسم/)).selectOption({ label: `${branch} / ${dept}` });
  await submit(page);
  await expectError(page);
  await closeDialogIfOpen(page);

  await deleteRow(page, office);
  await page.goto('/departments');
  await deleteRow(page, dept);
  await page.goto('/branches');
  await deleteRow(page, branch);
});

// ───────────────────────── المستخدمون ─────────────────────────
test('المستخدمون: إضافة بدور وتعديل الاسم وحذف', async ({ page }) => {
  const id = uid();
  const name = 'e2e مستخدم ' + id, email = `e2e${id}@test.local`;
  await page.goto('/users');
  await startCreate(page, /مستخدم جديد/);
  await (await field(page, 'الاسم الكامل')).fill(name);
  await (await field(page, 'البريد الإلكتروني')).fill(email);
  await (await field(page, 'كلمة المرور')).fill('E2e-' + id + 'x');
  const role = await field(page, 'الدور');
  await waitOptions(role);
  const roleValue = await role.locator('option').evaluateAll(os => (os as HTMLOptionElement[]).find(o => o.value && !/SuperAdmin|مدير النظام/.test(o.textContent ?? ''))?.value);
  await role.selectOption(roleValue!);
  await submit(page);
  await expectRow(page, email);

  await editRow(page, email);
  await (await field(page, 'الاسم الكامل')).fill(name + ' م');
  await submit(page);
  await expectRow(page, email, name + ' م');
  await deleteRow(page, email);
});

// ───────────────────────── الأدوار ─────────────────────────
test('الأدوار: إضافة دور بصلاحية، نسخه، تعديل الاسم، وحذف الاثنين', async ({ page }) => {
  const name = 'e2e دور ' + uid();
  await page.goto('/roles');
  await startCreate(page, /دور جديد/);
  await (await field(page, 'اسم الدور')).fill(name);
  // أول مجموعة صلاحيات: تُفتح ثم تُختار أول صلاحية فيها
  const dlg = await scope(page);
  const card = dlg.locator('.permission-card').first();
  await expect(async () => {
    if (!await card.isVisible()) await dlg.locator('.perm-group-toggle').first().click();
    await expect(card).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await card.click();
  await submit(page);
  await expectRow(page, name);

  await row(page, name).getByRole('button', { name: /نسخ الدور/ }).click();
  await expect(await field(page, 'اسم الدور')).toHaveValue(`${name} - نسخة`);
  await submit(page);
  await expectRow(page, `${name} - نسخة`);

  await editRow(page, `${name} - نسخة`);
  await (await field(page, 'اسم الدور')).fill(name + ' ب');
  await submit(page);
  await expectRow(page, name + ' ب');

  await deleteRow(page, name + ' ب');
  await deleteRow(page, name);
});

// خطأ قديم أُصلح (2026-10-10): كتابة خط العرض ثم الطول يدوياً لموقع جديد لم تكن تحدد النقطة
test('المواقع: كتابة الإحداثيين يدوياً تحدد النقطة والمحافظة', async ({ page }) => {
  await page.goto('/devices/sites');
  await startCreate(page, /موقع جديد/);
  await (await field(page, 'خط العرض')).fill('33.5138'); await page.keyboard.press('Tab');
  await (await field(page, 'خط الطول')).fill('36.2765'); await page.keyboard.press('Tab');
  await expect((await scope(page)).getByText('📍 دمشق')).toBeVisible();
  await closeDialogIfOpen(page);
});

// خطأ قديم أُصلح (2026-10-10): [value] على <select> كان يُظهر الخيار الأول بدل القيمة الفعلية
test('العطل: قائمة السنة تُظهر السنة المعروضة فعلاً', async ({ page }) => {
  await page.goto('/vacations/holidays');
  await expect(page.getByRole('combobox', { name: 'السنة' })).toHaveValue(String(new Date().getFullYear()));
});

// ───────────────────────── صفحات الترقيم من الخادم ─────────────────────────
test('أجهزة الصيانة: إضافة جهاز برقم تسلسلي مؤكَّد، ثم البحث عنه وحذفه', async ({ page }) => {
  const serial = 'E2E-' + uid();
  await page.goto('/maintenance/devices');
  await startCreate(page, /جهاز جديد/);
  await (await field(page, /^الرقم التسلسلي/)).fill(serial);
  await (await field(page, 'تأكيد الرقم التسلسلي')).fill(serial);
  const type = await field(page, 'نوع الجهاز'); await waitOptions(type); await type.selectOption({ index: 1 });
  const company = await field(page, 'الشركة المصنّعة'); await waitOptions(company); await company.selectOption({ index: 1 });
  await (await field(page, 'اسم الجهاز')).fill('e2e جهاز صيانة');
  await submit(page);
  await page.locator('main input[type=search]').first().fill(serial);
  await expectRow(page, serial);
  await deleteRow(page, serial);
});

test('قطع الغيار: إضافة قطعة ثم حذفها (بلا حركات)', async ({ page }) => {
  const name = 'e2e قطعة ' + uid();
  await page.goto('/maintenance/parts');
  await startCreate(page, /قطعة جديدة/);
  const dept = await field(page, 'مخزون القسم');
  if (await dept.count()) { await waitOptions(dept); await dept.selectOption({ index: 1 }); }
  await (await field(page, 'اسم القطعة')).fill(name);
  await (await field(page, 'الوحدة')).fill('قطعة');
  await submit(page);
  await page.locator('main input[type=search]').first().fill(name);
  await expectRow(page, name);
  await deleteRow(page, name);
});
