import { test as teardown, request } from '@playwright/test';

/**
 * تنظيف بيانات الاختبارات الوظيفية: يحذف كل سجل اسمه يبدأ بـ «e2e » (وبيانات flows القديمة «اختبار آلي …»)
 * حتى لو فشل اختبار في منتصفه. يمر عبر الـ API نفسه بصلاحيات المدير. الترتيب مهم: الأبناء قبل الآباء.
 */
const E2E = (name: string | undefined) => !!name && (/^e2e /.test(name) || /^(فرع )?اختبار آلي \d+$/.test(name));

teardown('حذف بيانات الاختبار المتبقية', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL: `${baseURL}/api/`, ignoreHTTPSErrors: true });
  const login = await (await api.post('Auth/login', { data: { email: process.env['E2E_ADMIN_EMAIL'] ?? 'admin@system.com', password: process.env['E2E_ADMIN_PASSWORD'] } })).json();
  const headers = { Authorization: `Bearer ${login.token}` };
  const list = async (path: string) => { const r = await api.get(path, { headers }); return r.ok() ? (await r.json()) as { id: number; name?: string; fullName?: string; email?: string }[] : []; };
  const del = async (path: string) => { await api.delete(path, { headers }); };

  const year = new Date().getFullYear() + 2;
  for (const h of await list(`PublicHolidays/GetAll?year=${year}`)) if (E2E(h.name)) await del(`PublicHolidays/Delete/${h.id}`);
  for (const t of await list('VacationTypes/GetAll')) if (E2E(t.name)) await del(`VacationTypes/Delete/${t.id}`);
  for (const t of await list('WorkTasks/GetAll')) if (E2E(t.name)) await del(`WorkTasks/Delete/${t.id}`);
  for (const d of await list('Devices/GetAll')) if (E2E(d.name)) await del(`Devices/Delete/${d.id}`);
  for (const s of await list('Sites/GetAll')) if (E2E(s.name)) await del(`Sites/Delete/${s.id}`);
  for (const kind of ['DamageTypes', 'MaintenanceRequestStatuses', 'DeviceTypes', 'DeviceCompanies'])
    for (const x of await list(`${kind}/GetAll`)) if (E2E(x.name)) await del(`${kind}/Delete/${x.id}`);
  const paged = async (path: string) => { const r = await api.get(path, { headers }); return r.ok() ? ((await r.json()).items ?? []) as { id: number; name?: string; serialNumber?: string }[] : []; };
  for (const d of await paged('MaintenanceDevices/GetAll?serialNumber=E2E-&pageSize=100')) if (/^E2E-\d+$/.test(d.serialNumber ?? '')) await del(`MaintenanceDevices/Delete/${d.id}`);
  for (const p of await paged('SpareParts/GetAll?search=e2e&pageSize=100')) if (E2E(p.name)) await del(`SpareParts/Delete/${p.id}`);
  for (const u of await list('Users/GetAll')) if (/^e2e\d+@test\.local$/.test(u.email ?? '')) await del(`Users/Delete/${u.id}`);
  for (const r of await list('Roles/GetAll')) if (E2E(r.name)) await del(`Roles/Delete/${r.id}`);
  for (const o of await list('Offices/GetAll')) if (E2E(o.name)) await del(`Offices/Delete/${o.id}`);
  for (const d of await list('Department/GetAll')) if (E2E(d.name)) await del(`Department/Delete/${d.id}`);
  for (const b of await list('Branches/GetAll')) if (E2E(b.name)) await del(`Branches/Delete/${b.id}`);
  for (const l of await list('ToDoLists/GetAll')) if (E2E(l.name)) await del(`ToDoLists/Delete/${l.id}`);

  await api.post('Auth/logout', { headers });
  await api.dispose();
});
