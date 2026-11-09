// يكشف التصديرات غير المستعملة في src/app (ثوابت ودوال وأصناف وأنواع ماتت بعد تعديل): يفشل إن وُجد أيٌّ منها.
// «مستعمل» = يرد اسمه في ملف آخر من src (شيفرة أو قالب أو أنماط، بما فيها main.ts). ما يُستعمل في الاختبارات وحدها
// يُذكر تحذيراً ولا يفشل الفحص. ملفات index.ts (الواجهات العامة للميزات) خارج الفحص.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = walk(root).filter(f => /\.(ts|html|scss|json)$/.test(f)).map(f => [f, readFileSync(f, 'utf8')]);
const isSpec = f => f.endsWith('.spec.ts');

const unused = [], specOnly = [];
for (const [file, text] of files) {
  if (!file.endsWith('.ts') || isSpec(file) || /[\\/]index\.ts$/.test(file) || !file.includes(join('src', 'app'))) continue;
  for (const m of text.matchAll(/export\s+(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g)) {
    const name = m[1], re = new RegExp(`\\b${name}\\b`);
    const inSelf = (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1;
    if (inSelf) continue;
    const elsewhere = files.filter(([g]) => g !== file && re.test(readFileSync(g, 'utf8')));
    const label = `${relative(root, file).replace(/\\/g, '/')} :: ${name}`;
    if (!elsewhere.some(([g]) => !isSpec(g))) (elsewhere.length ? specOnly : unused).push(label);
  }
}

if (specOnly.length) console.log(`تحذير — تصديرات تُستعمل في الاختبارات وحدها (${specOnly.length}):\n  ` + specOnly.join('\n  '));
if (unused.length) {
  console.error(`تصديرات غير مستعملة (${unused.length}) — احذفها أو استعملها:\n  ` + unused.join('\n  '));
  process.exit(1);
}
console.log('لا تصديرات غير مستعملة.');
