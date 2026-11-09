// المكوّنات تستعمل رموز التصميم (var(--…)) لا ألواناً خاماً — وإلا انكسرت الأوضاع الداكنة والمظاهر الأربعة.
// يفشل إن وُجد لون سداسي خام في src/app خارج المستثنيات: ملفات المظاهر والطباعة والتوقيع والأختام،
// والقيمة الاحتياطية var(--x, #fff)، والسطر الذي يحمل التعليق raw-color-ok (بيانات لون يختارها المستخدم أو ورق مقصود).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src/app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const SKIP_FILE = /(\.spec\.ts|theme\.service\.ts|[\\/]print|print-|signature|stamp)/i;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FALLBACK = /var\(--[\w-]+\s*,\s*#[0-9a-fA-F]{3,8}\)/g;

const hits = [];
for (const file of walk(root).filter(f => /\.(ts|scss|html)$/.test(f) && !SKIP_FILE.test(relative(root, f)))) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('raw-color-ok')) return;
    if (HEX.test(line.replace(FALLBACK, ''))) hits.push(`${relative(root, file).replace(/\\/g, '/')}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}
if (hits.length) {
  console.error(`ألوان خام خارج رموز التصميم (${hits.length}) — استعمل var(--…) أو أضف التعليق raw-color-ok لبيانات لون مقصودة:\n  ` + hits.join('\n  '));
  process.exit(1);
}
console.log('لا ألوان خام في المكوّنات.');
