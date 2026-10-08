// يعيد تسمية المخرجات close/cancel (تتعارض مع أحداث DOM) إلى closed ويحدّث الاستعمالات في القوالب
import fs from 'node:fs';
import { walk, root } from './codemod-move.mjs';

const files = walk(root).filter(f => !f.endsWith('.spec.ts'));
const renamed = [];   // { selector, from }

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (!/\b(close|cancel) = output<void>\(\);/.test(s)) continue;
  const parts = s.split(/(?=@Component\()/);
  const out = parts.map((c, i) => {
    if (i === 0) return c;
    const m = /\b(close|cancel) = output<void>\(\);/.exec(c);
    if (!m) return c;
    const sel = /selector:\s*'([^']+)'/.exec(c)?.[1];
    if (!sel) throw new Error('no selector in ' + f);
    renamed.push({ selector: sel, from: m[1] });
    return c.replace(new RegExp(`\\b${m[1]} = output<void>\\(\\);`), 'closed = output<void>();')
            .replace(new RegExp(`\\b${m[1]}\\.emit\\(`, 'g'), 'closed.emit(');
  });
  fs.writeFileSync(f, out.join(''));
}

let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8'), o = s;
  for (const { selector, from } of renamed) {
    s = s.replace(new RegExp(`(<${selector}\\b[^>]*?)\\(${from}\\)=`, 'g'), '$1(closed)=');
  }
  if (s !== o) { fs.writeFileSync(f, s); n++; }
}
console.log('renamed', renamed.map(r => `${r.selector}:${r.from}`).join(', '), '| files with updated usages:', n);
