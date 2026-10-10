// <select [value]="…"> → <select [appSelectValue]="…"> + استيراد SelectValue في المكوّن المالك للقالب
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const SEL = /<select\b([^>]*?)\s\[value\]="/g;
const IMPORT = "import { SelectValue } from '@shared/ui/select-value';";

function addImport(tsFile, chunkFilter) {
  let t = fs.readFileSync(tsFile, 'utf8');
  if (t.includes('SelectValue')) return;
  const parts = t.split(/(?=@Component\()/);
  t = parts.map((c, i) => (i === 0 || !chunkFilter(c)) ? c : c.replace(/imports:\s*\[/, 'imports: [SelectValue, ')).join('');
  const idx = t.indexOf('\n', t.lastIndexOf('\nimport ') + 1);
  t = t.slice(0, idx + 1) + IMPORT + '\n' + t.slice(idx + 1);
  fs.writeFileSync(tsFile, t);
}

let n = 0;
for (const f of walk(root)) {
  if (f.endsWith('.spec.ts') || f.endsWith('select-value.ts')) continue;
  if (f.endsWith('.html')) {
    const s = fs.readFileSync(f, 'utf8');
    if (!SEL.test(s)) continue;
    SEL.lastIndex = 0;
    const o = s.replace(SEL, (m, attrs) => { n++; return `<select${attrs} [appSelectValue]="`; });
    fs.writeFileSync(f, o);
    // المكوّن الذي يشير إلى هذا القالب
    const base = path.basename(f);
    const owner = walk(path.dirname(f)).find(x => x.endsWith('.ts') && fs.readFileSync(x, 'utf8').includes(`templateUrl: './${base}'`));
    if (!owner) throw new Error('owner not found for ' + f);
    addImport(owner, c => c.includes(`templateUrl: './${base}'`));
  } else if (f.endsWith('.ts')) {
    const s = fs.readFileSync(f, 'utf8');
    if (!/template:\s*`/.test(s) || !SEL.test(s)) { SEL.lastIndex = 0; continue; }
    SEL.lastIndex = 0;
    fs.writeFileSync(f, s.replace(SEL, (m, attrs) => { n++; return `<select${attrs} [appSelectValue]="`; }));
    addImport(f, c => /\[appSelectValue\]/.test(c));
  }
}
console.log('selects converted:', n);
