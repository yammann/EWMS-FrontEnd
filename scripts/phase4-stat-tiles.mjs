import fs from 'node:fs';
import path from 'node:path';

const re = /<article class="stat-card">\s*<div class="stat-top">\s*<div class="stat-icon (\w+)">\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>\s*<span class="stat-label">([^<]+)<\/span>\s*<\/div>\s*<div class="stat-value">([^<]+)<\/div>\s*<div class="stat-footer">\s*(?:<span class="live-dot"([^>]*)><\/span>\s*)?<span class="stat-description">([^<]+)<\/span>\s*<\/div>\s*<\/article>/g;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []);
let total = 0, files = 0;
for (const f of walk(path.resolve('src/app'))) {
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('<article class="stat-card">')) continue;
  let n = 0;
  const out = s.replace(re, (m, tone, svg, label, value, liveAttrs, hint) => {
    const v = value.trim();
    const vm = /^\{\{\s*([\s\S]*?)\s*\}\}$/.exec(v);
    if (/"/.test(v) || /"/.test(hint) || /"/.test(label)) return m;
    const valueAttr = vm ? `[value]="${vm[1]}"` : `value="${v}"`;
    let live = '';
    if (liveAttrs !== undefined) {
      const lm = /\[style\.display\]="([^"]*?) \? 'none' : 'inline-block'"/.exec(liveAttrs);
      live = lm ? ` [live]="!(${lm[1]})"` : ' live';
    }
    n++;
    return `<app-stat-tile tone="${tone}" icon="" label="${label.trim()}" ${valueAttr} hint="${hint.trim()}"${live}>\n${svg.replace(/^/gm, '      ')}\n    </app-stat-tile>`;
  });
  if (!n) continue;
  fs.writeFileSync(f, out); total += n; files++;
  const tsf = f.replace(/\.html$/, '.ts');
  if (fs.existsSync(tsf)) {
    let t = fs.readFileSync(tsf, 'utf8');
    if (!t.includes('StatTile')) {
      t = t.replace(/^(import [^\n]*\n)/m, `$1import { StatTile } from '@shared/ui/stat-tile';\n`).replace(/imports:\s*\[/, 'imports: [StatTile, ');
      fs.writeFileSync(tsf, t);
    }
  }
  console.log(path.relative(process.cwd(), f), n, 'of', (s.match(/<article class="stat-card">/g) || []).length);
}
console.log('total', total, 'files', files);
