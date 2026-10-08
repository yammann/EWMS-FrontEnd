import fs from 'node:fs';
import path from 'node:path';
const re = /<div class="row-actions">\s*@if \(([^)]*\(\)[^)]*)\) \{\s*<button type="button" class="icon-btn edit" title="تعديل"\s*\(click\)="([^"]+)">[\s\S]*?<\/button>\s*\}\s*@if \(([^)]*\(\)[^)]*)\) \{\s*<button type="button" class="icon-btn danger" title="حذف"\s*\(click\)="([^"]+)"\s*\[disabled\]="([^"]+)">[\s\S]*?<\/button>\s*\}\s*<\/div>/g;
for (const feat of ['branches', 'departments', 'offices', 'users', 'roles']) {
  const f = path.resolve('src/app/features', feat, 'pages', `${feat}-page.html`);
  let s = fs.readFileSync(f, 'utf8'); let n = 0;
  s = s.replace(re, (m, canEdit, edit, canDel, del, dis) => { n++; return `<app-row-actions [canEdit]="${canEdit}" [canDelete]="${canDel}" [deleting]="${dis}" (edit)="${edit}" (remove)="${del}" />`; });
  console.log(feat, n);
  if (!n) continue;
  fs.writeFileSync(f, s);
  const tsf = f.replace('.html', '.ts'); let t = fs.readFileSync(tsf, 'utf8');
  t = t.replace(/^(import [^\n]*\n)/m, `$1import { RowActions } from '@shared/ui/row-actions';\n`).replace(/imports:\s*\[/, 'imports: [RowActions, ');
  fs.writeFileSync(tsf, t);
}
