// لوحات المتابعة الخمس: كتلة «خريطة أو بلا خريطة» المكرَّرة → app-dashboard-frame
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('src/app/features/dashboard/pages');
const re = /  @if \(showMap\(\)\) \{[\s\S]*?\n  \}\n(?=<\/div>)/;
for (const name of ['branch', 'department', 'office', 'employee', 'overview']) {
  const f = path.join(dir, `${name}-dashboard.html`);
  let s = fs.readFileSync(f, 'utf8');
  if (!re.test(s)) throw new Error('block ' + name);
  s = s.replace(re, '  <app-dashboard-frame [showMap]="showMap()" [header]="headerTpl" [body]="bodyTpl" />\n');
  fs.writeFileSync(f, s);
  const tsf = path.join(dir, `${name}-dashboard.ts`);
  let t = fs.readFileSync(tsf, 'utf8');
  t = t.replace(/^(import [^\n]*\n)/m, `$1import { DashboardFrame } from '../components/dashboard-frame';\n`).replace(/imports:\s*\[/, 'imports: [DashboardFrame, ');
  fs.writeFileSync(tsf, t);
}
console.log('done');
