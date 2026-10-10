// المرحلة 1-ب: توحيد دوال التنسيق (utcDate/money/qty/تاريخ اليوم) في core/utils/format.ts + أنابيب في shared/pipes
import fs from 'node:fs';
import path from 'node:path';
import { retarget, root, walk } from './codemod-move.mjs';

const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, s) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), s); };
const cut = (src, re) => { const m = re.exec(src); if (!m) throw new Error('cut ' + re); return [src.replace(m[0], ''), m[0]]; };

// ───── core/utils/format.ts ─────
let mm = rd('core/models/maintenance.models.ts');
let sp = rd('core/models/spare-part.models.ts');
let utcBlock, moneyBlock, qtyBlock;
[mm, utcBlock] = cut(mm, /\/\*\*\n \* تواريخ النظام[\s\S]*?\nexport function utcDate[\s\S]*?\n\}\n\n?/);
[sp, moneyBlock] = cut(sp, /\/\*\* مبلغ بالليرة[\s\S]*?\nexport function money[\s\S]*?\n\}\n\n?/);
[sp, qtyBlock] = cut(sp, /\/\*\* كمية بخانتين[\s\S]*?\nexport function qty[\s\S]*?\n\}\n\n?/);
wr('core/models/maintenance.models.ts', mm);
wr('core/models/spare-part.models.ts', sp);
wr('core/utils/format.ts',
  utcBlock.trimEnd() + '\n\n' + moneyBlock.trimEnd() + '\n\n' + qtyBlock.trimEnd() + `

/** تاريخ اليوم (أو التاريخ المعطى) المحلي بصيغة yyyy-MM-dd — قيمة حقل date */
export function localDateInput(d: Date = new Date()): string {
  return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
}
`);
const fromAny = names => (s) => /(maintenance\.models|spare-part\.models)$/.test(s);
console.log('utcDate', retarget(['utcDate'], fromAny(), '@core/utils/format'));
console.log('money/qty', retarget(['money', 'qty'], fromAny(), '@core/utils/format'));
// maintenance.models / spare-part.models ربما تستعمل الدوال داخلياً
for (const f of ['core/models/maintenance.models.ts', 'core/models/spare-part.models.ts']) {
  const s = rd(f); const used = ['utcDate', 'money', 'qty'].filter(n => new RegExp('\\b' + n + '\\(').test(s));
  if (used.length) wr(f, `import { ${used.join(', ')} } from '@core/utils/format';\n` + s);
}

// ───── الأنابيب ─────
wr('shared/pipes/format.pipes.ts', `import { Pipe, PipeTransform } from '@angular/core';
import { money, qty, utcDate } from '@core/utils/format';

/** تاريخ UTC قادم من الخادم بلا منطقة زمنية → Date محلي (يُستعمل قبل date) */
@Pipe({ name: 'utc', standalone: true })
export class UtcPipe implements PipeTransform {
  transform(value: string | null | undefined): Date | null { return utcDate(value); }
}

/** مبلغ بالليرة السورية: 12,500 ل.س */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return money(value); }
}

/** كمية بخانتين عشريتين على الأكثر */
@Pipe({ name: 'qty', standalone: true })
export class QtyPipe implements PipeTransform {
  transform(value: number): string { return qty(value); }
}
`);

// ───── ترحيل القوالب والحقول ─────
const PIPE = { utc: 'UtcPipe', money: 'MoneyPipe', qty: 'QtyPipe' };
let touched = 0;
for (const file of walk(root)) {
  if (/format\.pipes\.ts$|format\.ts$|\.spec\.ts$/.test(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!/@Component\(/.test(src)) continue;
  const parts = src.split(/(?=@Component\()/);
  const used = new Set();
  const out = parts.map((chunk, i) => {
    if (i === 0) return chunk;
    let c = chunk;
    const before = c;
    // utc(x) | date  →  x | utc | date
    c = c.replace(/\butc\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*\|\s*date/g, (m, a) => (used.add('utc'), `${a.trim()} | utc | date`));
    // money(x) / qty(x) داخل {{ }} كاملة
    for (const n of ['money', 'qty']) {
      c = c.replace(new RegExp(`\\{\\{\\s*${n}\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)\\s*\\}\\}`, 'g'), (m, a) => (used.add(n), `{{ ${a.trim()} | ${n} }}`));
      c = c.replace(new RegExp(`\\b${n}\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)`, 'g'), (m, a, off) => {
        // خارج القوالب (داخل الصنف) نترك الاستدعاء كما هو
        const tpl = c.indexOf('template:'), tplEnd = c.indexOf('styles:');
        const inTpl = off > tpl && (tplEnd < 0 || off < tplEnd) && tpl >= 0;
        if (!inTpl) return m;
        used.add(n); return `(${a.trim()} | ${n})`;
      });
    }
    return c;
  });
  let res = out.join('');
  if (!used.size) continue;
  // إزالة حقول الصنف: utc = utcDate; money = money; qty = qty;
  res = res.replace(/^[ \t]*utc = utcDate;\n/gm, '').replace(/^[ \t]*money = money; qty = qty;( utc = utcDate;)?\n/gm, '')
    .replace(/^[ \t]*money = money;\n/gm, '').replace(/ utc = utcDate;/g, '').replace(/ money = money;/g, '').replace(/ qty = qty;/g, '');
  // إضافة الأنابيب إلى imports كل مكوّن يستعملها
  const parts2 = res.split(/(?=@Component\()/);
  res = parts2.map((c, i) => {
    if (i === 0) return c;
    for (const n of used) {
      if (!new RegExp(`\\| ${n}\\b`).test(c)) continue;
      const cls = PIPE[n];
      if (/imports:\s*\[/.test(c)) { if (!new RegExp(`imports:\\s*\\[[^\\]]*\\b${cls}\\b`).test(c)) c = c.replace(/imports:\s*\[/, `imports: [${cls}, `); }
      else c = c.replace(/standalone: true,?/, m => `${m} imports: [${cls}],`);
    }
    return c;
  }).join('');
  // استيراد الأنابيب
  const cls = [...used].map(n => PIPE[n]);
  const line = `import { ${cls.join(', ')} } from '@shared/pipes/format.pipes';\n`;
  const idx = res.indexOf('\n', res.lastIndexOf('\nimport ') + 1);
  res = res.slice(0, idx + 1) + line + res.slice(idx + 1);
  fs.writeFileSync(file, res); touched++;
}
console.log('components migrated', touched);

// ───── تاريخ اليوم ─────
const dayFns = [
  ['features/devices/installations-page.ts', /function todayInput\(\): string \{[\s\S]*?\n\}\n\n?/, 'todayInput'],
  ['features/maintenance/spare-part-dialogs.ts', /function todayInput\(\): string \{[\s\S]*?\n\}\n\n?/, 'todayInput'],
  ['features/maintenance/spare-parts-report-page.ts', /function dateInput\(d: Date\): string \{[\s\S]*?\n\}\n\n?/, 'dateInput'],
];
for (const [f, re, name] of dayFns) {
  let s = rd(f); [s] = cut(s, re);
  s = s.replace(new RegExp(`\\b${name}\\(`, 'g'), 'localDateInput(');
  s = s.replace(/^(import [^\n]*\n)(?!import)/m, `$1import { localDateInput } from '@core/utils/format';\n`);
  wr(f, s);
}
// localToday في profile-page ← يُستبدل بـ localDateInput
{
  let p = rd('features/profile/profile-page.ts');
  [p] = cut(p, /\/\*\* تاريخ اليوم المحلي بصيغة yyyy-MM-dd[^\n]*\*\/\nexport function localToday\(\) \{[\s\S]*?\n\}\n\n?/);
  p = p.replace(/\blocalToday\(\)/g, 'localDateInput()');
  p = p.replace(/^(import [^\n]*\n)/m, `$1import { localDateInput } from '@core/utils/format';\n`);
  wr('features/profile/profile-page.ts', p);
  console.log('localToday users', walk(root).filter(f => /\blocalToday\b/.test(fs.readFileSync(f, 'utf8'))));
}
