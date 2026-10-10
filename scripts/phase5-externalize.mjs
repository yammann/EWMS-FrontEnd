// يُخرج القوالب الكبيرة (> 25 سطراً) والأنماط الكبيرة (> 12 سطراً) من ملفات المكوّنات إلى ملفات .html/.scss بجوارها
// تشغيل: node scripts/phase5-externalize.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { walk, root } from './codemod-move.mjs';

const DRY = process.argv.includes('--dry');
const TPL_MIN = 25, STY_MIN = 12;

const cook = raw => (0, eval)('`' + raw + '`');          // لا يوجد ${ في أي قالب (تم التحقق)
const dedent = text => {
  const lines = text.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const indents = lines.filter(l => l.trim()).map(l => /^ */.exec(l)[0].length);
  const min = Math.min(...indents, 99);
  return lines.map(l => l.slice(Math.min(min, /^ */.exec(l)[0].length))).join('\n') + '\n';
};

let tplCount = 0, styCount = 0;
for (const file of walk(root)) {
  if (file.endsWith('.spec.ts')) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!/@Component\(/.test(src)) continue;
  const dir = path.dirname(file), base = path.basename(file, '.ts');
  const parts = src.split(/(?=@Component\()/);
  const multi = parts.length > 2;
  let changed = false;
  const out = parts.map((chunk, idx) => {
    if (idx === 0) return chunk;
    const sel = /selector:\s*'app-([^']+)'/.exec(chunk)?.[1] ?? String(idx);
    const stem = multi ? `${base}-${sel}` : base;
    let c = chunk;

    const tm = /template:\s*`([\s\S]*?)`/.exec(c);
    if (tm && tm[1].split('\n').length > TPL_MIN && !/templateUrl:/.test(c)) {
      const html = dedent(cook(tm[1]));
      if (!DRY) fs.writeFileSync(path.join(dir, stem + '.html'), html);
      c = c.replace(tm[0], `templateUrl: './${stem}.html'`);
      tplCount++; changed = true;
    }

    const sm = /styles:\s*\[\s*`([\s\S]*?)`\s*\]/.exec(c);
    if (sm && sm[1].split('\n').length > STY_MIN) {
      const css = dedent(cook(sm[1]));
      if (!DRY) fs.writeFileSync(path.join(dir, stem + '.scss'), css);
      const own = `./${stem}.scss`;
      const urlsM = /styleUrls:\s*\[([^\]]*)\]/.exec(c), urlM = /styleUrl:\s*('[^']+')/.exec(c);
      if (urlsM) c = c.replace(sm[0] + ',', '').replace(sm[0], '').replace(urlsM[0], `styleUrls: [${urlsM[1].trim()}, '${own}']`);
      else if (urlM) c = c.replace(sm[0] + ',', '').replace(sm[0], '').replace(urlM[0], `styleUrls: [${urlM[1]}, '${own}']`);
      else c = c.replace(sm[0], `styleUrl: '${own}'`);
      styCount++; changed = true;
    }
    return c;
  });
  if (changed && !DRY) fs.writeFileSync(file, out.join(''));
}
console.log('templates externalized:', tplCount, '| styles externalized:', styCount);
