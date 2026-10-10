// المرحلة 3: إعادة تنظيم src/app/features إلى pages / components / data-access / utils / styles لكل ميزة،
// ونقل الخدمات والنماذج أحادية الاستعمال من core إلى data-access الميزة، وتوليد index.ts (الواجهة العامة) تلقائياً.
// تشغيل: node scripts/phase3-restructure.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const root = path.resolve('src/app');
const posix = p => p.split(path.sep).join('/');
const rel = abs => posix(path.relative(root, abs));
const abs = r => path.join(root, r);

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const all = walk(root).filter(f => /\.(ts|html|scss)$/.test(f));
const exists = new Set(all.map(f => path.resolve(f)));

// ───────────────────────── قواعد النقل ─────────────────────────
const CORE_TO_FEATURE = {
  'core/services/assigned-task.service': 'task-board', 'core/services/assigned-task.service.spec': 'task-board', 'core/models/assigned-task.models': 'task-board',
  'core/services/todo.service': 'todo', 'core/services/todo.service.spec': 'todo', 'core/models/todo.models': 'todo',
  'core/services/maintenance.service': 'maintenance', 'core/models/maintenance.models': 'maintenance', 'core/models/spare-part.models': 'maintenance',
  'core/services/device.service': 'devices', 'core/services/device.service.spec': 'devices', 'core/models/device.models': 'devices',
  'core/services/vacation.service': 'vacations', 'core/services/vacation.service.spec': 'vacations', 'core/models/vacation.models': 'vacations',
  'core/services/work-task.service': 'work-tasks', 'core/models/work-task.models': 'work-tasks',
  'core/services/dashboard.service': 'dashboard', 'core/models/dashboard.models': 'dashboard',
  'core/services/places.service': 'map',
};
const SHARED_STYLES = {
  'features/shared/organization.scss': 'shared/styles/organization.scss',
  'features/devices/devices.scss': 'shared/styles/devices.scss',
  'features/maintenance/maintenance.scss': 'shared/styles/maintenance.scss',
  'features/dashboard/dashboard.scss': 'shared/styles/dashboard.scss',
};

const hasComponent = f => /@Component\(/.test(fs.readFileSync(f, 'utf8'));
const oldOfNew = new Map();
const moves = new Map();   // old abs → new abs

for (const f of all) {
  const r = rel(f);
  const noExt = r.replace(/\.(ts|html|scss)$/, '');
  if (CORE_TO_FEATURE[noExt]) { moves.set(f, abs(`features/${CORE_TO_FEATURE[noExt]}/data-access/${path.basename(f)}`)); continue; }
  if (SHARED_STYLES[r]) { moves.set(f, abs(SHARED_STYLES[r])); continue; }
  const m = /^features\/([^/]+)\/(.+)$/.exec(r);
  if (!m) continue;
  const [, feat, rest] = m;
  const base = path.basename(rest);
  if (rest === 'index.ts') continue;
  if (rest.includes('/')) {                       // features/auth/login/login.component.*
    if (feat === 'auth') moves.set(f, abs(`features/auth/pages/${base}`));
    continue;
  }
  const stem = base.replace(/\.(ts|html|scss)$/, '');
  const isPageName = /-page$|-dashboard$/.test(stem) || stem === 'dashboard-home';
  if (base.endsWith('.ts')) {
    const comp = hasComponent(f);
    moves.set(f, abs(`features/${feat}/${comp ? (isPageName ? 'pages' : 'components') : 'utils'}/${base}`));
  } else {
    // html/scss: بجوار مكوّنه إن وُجد ts بالاسم نفسه، وإلا styles/
    const ts = path.join(path.dirname(f), stem + '.ts');
    if (exists.has(path.resolve(ts)) && !SHARED_STYLES[r]) {
      const comp = hasComponent(ts);
      moves.set(f, abs(`features/${feat}/${comp ? (isPageName ? 'pages' : 'components') : 'utils'}/${base}`));
    } else moves.set(f, abs(`features/${feat}/styles/${base}`));
  }
}
for (const [o, n] of moves) oldOfNew.set(path.resolve(n), path.resolve(o));
const newOf = f => moves.get(path.resolve(f)) ?? path.resolve(f);
for (const [k, v] of [...moves]) { moves.delete(k); moves.set(path.resolve(k), path.resolve(v)); }

// ───────────────────────── حلّ المحدِّدات ─────────────────────────
function resolveSpec(spec, importerOld) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(importerOld), spec);
  else if (spec.startsWith('@core/')) base = abs('core/' + spec.slice(6));
  else if (spec.startsWith('@shared/')) base = abs('shared/' + spec.slice(8));
  else if (spec.startsWith('@features/')) base = abs('features/' + spec.slice(10));
  else return null;
  for (const c of [base, base + '.ts', base + '.scss', base + '.html', path.join(base, 'index.ts')]) if (exists.has(path.resolve(c))) return path.resolve(c);
  return null;
}
const featureOf = f => { const r = rel(f); const m = /^features\/([^/]+)\//.exec(r); return m ? m[1] : null; };
const layerOf = f => rel(f).split('/')[0];
const isRoutes = f => /\.routes\.ts$/.test(f);

const barrel = {};  // feature → Map(newTargetFile → Set(names))
const isTypeExport = new Map();
function typeNames(file) {
  if (!isTypeExport.has(file)) {
    const s = fs.readFileSync(oldOfNew.get(file) ?? file, 'utf8'); const set = new Set();
    for (const m of s.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)) set.add(m[1]);
    isTypeExport.set(file, set);
  }
  return isTypeExport.get(file);
}

function newSpec(spec, importerOld, kind, names) {
  const target = resolveSpec(spec, importerOld);
  if (!target) return spec;
  const importerNew = newOf(importerOld), targetNew = newOf(target);
  const iF = featureOf(importerNew), tF = featureOf(targetNew), tL = layerOf(targetNew);
  const noExt = p => p.replace(/\.ts$/, '');
  if (tL === 'core' || tL === 'shared') {
    if (kind === 'style') return posix(path.relative(path.dirname(importerNew), targetNew)).replace(/^(?!\.)/, './');
    return '@' + tL + '/' + noExt(rel(targetNew).slice(tL.length + 1));
  }
  if (tL !== 'features') return spec;
  if (iF === tF && iF !== null) {
    let r = posix(path.relative(path.dirname(importerNew), targetNew));
    if (kind !== 'style' && kind !== 'template') r = noExt(r);
    if (path.basename(targetNew) === 'index.ts' && kind === 'code') r = r.replace(/\/?index$/, '') || '.';
    return r.startsWith('.') ? r : './' + r;
  }
  if (kind === 'style' || kind === 'template') return posix(path.relative(path.dirname(importerNew), targetNew)).replace(/^(?!\.)/, './');
  // استيراد من ميزة أخرى
  if (path.basename(targetNew) === 'index.ts') return '@features/' + tF;
  if (isRoutes(importerNew) || path.basename(importerNew) === 'app.routes.ts' || kind === 'dynamic') return '@features/' + noExt(rel(targetNew).slice('features/'.length));
  // اِستيراد ملف داخلي من ميزة أخرى → عبر index (نُسجّل الرموز لتوليده)
  if (names?.length) {
    const m = (barrel[tF] ??= new Map());
    const set = m.get(targetNew) ?? new Set(); names.forEach(n => set.add(n)); m.set(targetNew, set);
  }
  return '@features/' + tF;
}

const parseNames = list => list.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim());

function rewrite(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) return s;
  if (file.endsWith('.scss')) {
    return s.replace(/@(use|import|forward)\s+'([^']+)'/g, (m, kw, spec) => {
      if (!spec.startsWith('.')) return m;
      return `@${kw} '${newSpec(spec, file, 'style')}'`;
    });
  }
  s = s.replace(/(import|export)\s+(type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g, (m, kw, ty, list, spec) =>
    `${kw} ${ty ?? ''}{${list}} from '${newSpec(spec, file, 'code', parseNames(list))}'`);
  s = s.replace(/import\(\s*'([^']+)'\s*\)/g, (m, spec) => `import('${newSpec(spec, file, 'dynamic')}')`);
  s = s.replace(/(import|export)\s+(\*\s+as\s+\w+\s+from\s+|\*\s+from\s+)'([^']+)'/g, (m, kw, mid, spec) => `${kw} ${mid}'${newSpec(spec, file, 'code')}'`);
  s = s.replace(/import\s+'([^']+)'/g, (m, spec) => spec.startsWith('.') ? `import '${newSpec(spec, file, 'code')}'` : m);
  s = s.replace(/(templateUrl|styleUrl)\s*:\s*'([^']+)'/g, (m, k, spec) => `${k}: '${newSpec(spec, file, k === 'templateUrl' ? 'template' : 'style')}'`);
  s = s.replace(/styleUrls\s*:\s*\[([^\]]*)\]/g, (m, list) =>
    `styleUrls: [${list.replace(/'([^']+)'/g, (mm, spec) => `'${newSpec(spec, file, 'style')}'`)}]`);
  return s;
}

// ───────────────────────── التنفيذ ─────────────────────────
const out = new Map();   // new abs → content
for (const f of all) out.set(newOf(f), rewrite(f));

// توليد واجهات الميزات
for (const [feat, files] of Object.entries(barrel)) {
  const idx = abs(`features/${feat}/index.ts`);
  const lines = new Map();   // newTarget → {values:Set, types:Set}
  const existing = out.get(idx) ?? '';
  for (const m of existing.matchAll(/export\s+\{([^}]*)\}\s*from\s*'([^']+)';?/g)) {
    const specAbs = path.resolve(path.dirname(idx), m[2]);
    const e = lines.get(specAbs) ?? { values: new Set(), types: new Set() };
    for (const raw of m[1].split(',').map(x => x.trim()).filter(Boolean)) raw.startsWith('type ') ? e.types.add(raw.slice(5)) : e.values.add(raw);
    lines.set(specAbs, e);
  }
  for (const [file, names] of files) {
    const key = file.replace(/\.ts$/, '');
    const e = lines.get(key) ?? { values: new Set(), types: new Set() };
    for (const n of names) (typeNames(file).has(n) ? e.types : e.values).add(n);
    lines.set(key, e);
  }
  const body = [...lines].sort((a, b) => a[0].localeCompare(b[0])).map(([target, e]) => {
    const spec = './' + posix(path.relative(path.dirname(idx), target));
    const items = [...[...e.values].sort(), ...[...e.types].sort().map(t => `type ${t}`)];
    return `export { ${items.join(', ')} } from '${spec}';`;
  }).join('\n') + '\n';
  out.set(idx, body);
}

if (DRY) { console.log('moves:', moves.size, 'barrels:', Object.keys(barrel).join(', ')); process.exit(0); }

// الكتابة: حذف القديم ثم كتابة الجديد
for (const f of all) if (newOf(f) !== path.resolve(f)) fs.rmSync(f);
for (const [file, content] of out) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
// حذف المجلدات الفارغة
const prune = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { prune(path.join(d, e.name)); } if (!fs.readdirSync(d).length && d !== root) fs.rmdirSync(d); };
prune(root);
console.log('moved', moves.size, 'files; barrels:', Object.keys(barrel).join(', '));
