// PagedResult نوع عام للـ API → core/models/paged-result.model.ts
import fs from 'node:fs';
import path from 'node:path';
import { walk, root } from './codemod-move.mjs';

const mm = path.join(root, 'features/maintenance/data-access/maintenance.models.ts');
let s = fs.readFileSync(mm, 'utf8');
const m = /export interface PagedResult<T> \{[\s\S]*?\n\}\n\n?/.exec(s);
fs.writeFileSync(path.join(root, 'core/models/paged-result.model.ts'), m[0].trimEnd() + '\n');
s = s.replace(m[0], '');
fs.writeFileSync(mm, s);

const IMPORT = "import { PagedResult } from '@core/models/paged-result.model';";
for (const f of walk(root)) {
  let c = fs.readFileSync(f, 'utf8'), o = c;
  // من الواجهات/النماذج: حذف الاسم من الاستيراد وإضافة الاستيراد الجديد
  c = c.replace(/import \{([^}]*)\} from '([^']+)';/g, (all, list, spec) => {
    const items = list.split(',').map(x => x.trim()).filter(Boolean);
    if (!items.includes('PagedResult') && !items.includes('type PagedResult')) return all;
    const rest = items.filter(x => !/^(type )?PagedResult$/.test(x));
    return (rest.length ? `import { ${rest.join(', ')} } from '${spec}';\n` : '') + IMPORT;
  });
  // index.ts للصيانة: إعادة التصدير القديمة
  c = c.replace(/export \{ type PagedResult \} from '[^']+';\n/, '');
  if (/\bPagedResult\b/.test(c) && !c.includes('paged-result.model') && !/export interface PagedResult/.test(c)) c = IMPORT + '\n' + c;
  if (c !== o) fs.writeFileSync(f, c);
}
