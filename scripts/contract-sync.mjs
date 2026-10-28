// عقد الواجهة مع الباكاند: ملفان ذهبيان يملكهما مستودع الباكاند (contract/permissions.json وcontract/openapi.json).
//   node scripts/contract-sync.mjs          ينسخهما من مستودع الباكاند المجاور إلى contract/ هنا
//   node scripts/contract-sync.mjs --check  يقارن النسختين (إن وُجد الباكاند مجاوراً)، ويفشل عند اختلافهما
// المسار الافتراضي ..\EWMSSS، وغيّره بمتغير البيئة EWMS_BACKEND. في CI لا يوجد الباكاند فيُتخطى الفحص.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backend = resolve(process.env.EWMS_BACKEND ?? '../EWMSSS', 'contract');
const files = ['permissions.json', 'openapi.json'];
const check = process.argv.includes('--check');

if (!existsSync(backend)) {
  if (check) {
    console.log(`مستودع الباكاند غير موجود في ${backend}: تخطّي مقارنة العقد (يعمل محلياً فقط).`);
    process.exit(0);
  }
  console.error(`لا يوجد ${backend}. اضبط EWMS_BACKEND على مجلد مستودع الباكاند.`);
  process.exit(1);
}

mkdirSync('contract', { recursive: true });
let stale = 0;
for (const file of files) {
  const from = resolve(backend, file);
  const to = resolve('contract', file);
  if (check) {
    const same = existsSync(to) && readFileSync(from, 'utf8').replace(/\r\n/g, '\n') === readFileSync(to, 'utf8').replace(/\r\n/g, '\n');
    if (!same) { stale++; console.error(`contract/${file} لا يطابق نسخة الباكاند. شغّل: npm run contract:sync`); }
  } else {
    copyFileSync(from, to);
    console.log(`نُسخ ${file}`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log('عقد الباكاند والواجهة متطابقان.');
}
