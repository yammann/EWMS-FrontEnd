// أدوات نقل رموز بين الملفات مع تعديل الاستيرادات (تُستعمل في إعادة الهيكلة)
import fs from 'node:fs';
import path from 'node:path';

export const root = path.resolve('src/app');
export const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts)$/.test(e.name) ? [path.join(d, e.name)] : []);

/** يحوّل استيراد الأسماء `names` القادمة من أي محدِّد يطابق `fromTest` إلى `toSpec`. */
export function retarget(names, fromTest, toSpec, exceptFile) {
  let n = 0;
  for (const file of walk(root)) {
    if (exceptFile && path.resolve(file) === path.resolve(exceptFile)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const out = src.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/g, (m, list, spec) => {
      if (!fromTest(spec, file)) return m;
      const items = list.split(',').map(s => s.trim()).filter(Boolean);
      const moved = items.filter(i => names.includes(i.replace(/^type\s+/, '').split(/\s+as\s+/)[0]));
      if (!moved.length) return m;
      const rest = items.filter(i => !moved.includes(i));
      const toLine = `import { ${moved.join(', ')} } from '${toSpec}';`;
      return rest.length ? `import { ${rest.join(', ')} } from '${spec}';\n${toLine}` : toLine;
    });
    if (out !== src) { fs.writeFileSync(file, out); n++; }
  }
  return n;
}
