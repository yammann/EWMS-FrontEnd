import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('src/app/features');
const re = /<header class="page-header">\s*<div class="page-title">\s*<span class="eyebrow">\s*<span class="eyebrow-dot"><\/span>\s*([^<]+?)\s*<\/span>\s*<h1>([^<]+)<\/h1>\s*<p>([^<]+)<\/p>\s*<\/div>\s*<div class="header-actions">\s*<button type="button" class="refresh-btn" \(click\)="load\(true\)" \[disabled\]="loading\(\)">[\s\S]*?<\/button>\s*@if \(([^)]*(?:\(\))?[^)]*)\) \{\s*<button type="button" class="new-btn" \(click\)="([^"]+)">[\s\S]*?<span>([^<]+)<\/span>\s*<\/button>\s*\}\s*<\/div>\s*<\/header>/;
let n = 0;
for (const feat of ['branches', 'departments', 'offices', 'users', 'roles']) {
  const f = path.join(root, feat, 'pages', `${feat}-page.html`);
  let s = fs.readFileSync(f, 'utf8');
  const m = re.exec(s);
  if (!m) { console.log('NO MATCH', feat); continue; }
  const [all, eyebrow, h1, sub, cond, createCall, label] = m;
  const rep = `<app-admin-header eyebrow="${eyebrow.trim()}" heading="${h1.trim()}" subtitle="${sub.trim()}" [loading]="loading()"\n    [createLabel]="${cond.trim()} ? '${label.trim()}' : ''" (refresh)="load(true)" (create)="${createCall.trim()}" />`;
  s = s.replace(all, rep);
  fs.writeFileSync(f, s);
  // استيراد المكوّن
  const tsf = path.join(root, feat, 'pages', `${feat}-page.ts`);
  let t = fs.readFileSync(tsf, 'utf8');
  if (!t.includes('AdminHeader')) {
    t = t.replace(/^(import [^\n]*\n)/m, `$1import { AdminHeader } from '@shared/ui/admin-header';\n`);
    t = t.replace(/imports:\s*\[/, 'imports: [AdminHeader, ');
    fs.writeFileSync(tsf, t);
  }
  n++;
}
console.log('converted', n);
