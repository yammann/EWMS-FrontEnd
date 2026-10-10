// يزيل $any($event.target) من القوالب: متغيّر مرجعي مطبوع (#tN) على العنصر نفسه بدل التحويل غير الآمن
import fs from 'node:fs';
import path from 'node:path';
import { root } from './codemod-move.mjs';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /.(ts|html)$/.test(e.name) ? [path.join(d, e.name)] : []);

const TAG = /<(input|select|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
let files = 0, total = 0;
for (const f of walk(root)) {
  if (f.endsWith('.spec.ts')) continue;
  const targets = [f];
  for (const file of targets) {
    const s = fs.readFileSync(file, 'utf8');
    if (!s.includes('$any($event.target)')) continue;
    let n = 0;
    const out = s.replace(TAG, tag => {
      if (!tag.includes('$any($event.target)')) return tag;
      const name = `t${++n}`;
      total++;
      return tag.replace(/\$any\(\$event\.target\)/g, name).replace(/^<(input|select|textarea)/, `<$1 #${name}`);
    });
    if (out !== s) { fs.writeFileSync(file, out); files++; }
  }
}
// قوالب html الخارجية
for (const f of walk(root)) void f;
console.log('files', files, 'replacements', total);
