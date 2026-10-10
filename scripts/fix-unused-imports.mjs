// يحذف الأسماء غير المستعملة من جمل import (بعد النقل الآلي). تشغيل: node scripts/fix-unused-imports.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
let out;
try { out = execSync('npx eslint src -f json', { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { out = e.stdout; }
let n = 0;
for (const r of JSON.parse(out)) {
  const names = r.messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars').map(m => /'([^']+)'/.exec(m.message)?.[1]).filter(Boolean);
  if (!names.length) continue;
  let s = fs.readFileSync(r.filePath, 'utf8');
  const o = s;
  s = s.replace(/import\s*\{([^}]*)\}\s*from\s*('[^']+');?[ \t]*\n/g, (m, list, spec) => {
    const items = list.split(',').map(x => x.trim()).filter(Boolean);
    const keep = items.filter(i => !names.includes(i.replace(/^type\s+/, '').split(/\s+as\s+/).pop()));
    if (keep.length === items.length) return m;
    n += items.length - keep.length;
    return keep.length ? `import { ${keep.join(', ')} } from ${spec};\n` : '';
  });
  if (s !== o) fs.writeFileSync(r.filePath, s);
}
console.log('removed', n);
