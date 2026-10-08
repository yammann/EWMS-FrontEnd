// تسمية ملفات shared/styles بأسماء تدل على محتواها + حذف قواعد مطابقة حرفياً للعامة
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const MAP = { organization: 'page-base', devices: 'data-tools', maintenance: 'list-tools', dashboard: 'dashboard-layout' };

for (const [from, to] of Object.entries(MAP)) fs.renameSync(path.join(root, `shared/styles/${from}.scss`), path.join(root, `shared/styles/${to}.scss`));

let n = 0;
for (const f of walk(root).filter(f => /\.(ts|scss)$/.test(f))) {
  let s = fs.readFileSync(f, 'utf8'), o = s;
  for (const [from, to] of Object.entries(MAP)) s = s.replaceAll(`shared/styles/${from}.scss`, `shared/styles/${to}.scss`);
  if (s !== o) { fs.writeFileSync(f, s); n++; }
}

const edit = (f, fn) => { const p = path.join(root, 'shared/styles', f); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
// .header-actions مطابقة حرفياً لقاعدة src/styles/_base.scss
edit('data-tools.scss', s => s.replace(/\.header-actions \{[^}]*\}\n/, '').replace('/* مشترك بين صفحات توثيق الأجهزة (مع ../shared/organization.scss) */', '/* أدوات الصفحات الجدولية: شريط أدوات، رقائق فلترة، خلايا الجدول، شبكة نماذج — مع page-base.scss */'));
edit('dashboard-layout.scss', s => s.replace(/\.header-actions \{[^}]*\}\n/, ''));
edit('list-tools.scss', s => s.replace('/* مشترك بين صفحات الصيانة (مع ../shared/organization.scss و ../devices/devices.scss) */', '/* أدوات القوائم: شريط فلاتر، مبدّل عرض، شبكة الحقائق، إحصاءات 4 أعمدة — مع page-base.scss و data-tools.scss */'));
edit('page-base.scss', s => '/* أساس صفحات الإدارة والتفاصيل: الصفحة واللوحة وبطاقة الهوية وشبكات النماذج */\n' + s);
console.log('references updated in', n, 'files');
