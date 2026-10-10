// صفحات الترقيم من الخادم: أزرار الصف الموحّدة (app-row-actions) + مؤشر الحذف على الصف
import fs from 'node:fs';

const F = 'src/app/features/';
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 90)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

const pages = [
  {
    ts: 'maintenance/pages/devices-page.ts', html: 'maintenance/pages/devices-page.html', v: 'device', method: 'remove', svc: 'deleteDevice',
    row: /<td><div class="row-actions">\s*@if \(can\(\)\.viewRequests\)[\s\S]*?<\/div><\/td>/,
    rep: `<td><app-row-actions [canEdit]="can().editDevice && !!lookups()" [canDelete]="can().deleteDevice" [deleting]="deletingId() === d.id" (edit)="openForm(d)" (remove)="remove(d)">
                @if (can().viewRequests) { <button class="btn btn-ghost btn-sm" type="button" (click)="openHistory(d)">سجل الإصلاحات</button> }
              </app-row-actions></td>`
  },
  {
    ts: 'maintenance/pages/spare-parts-page.ts', html: 'maintenance/pages/spare-parts-page.html', v: 'part', method: 'remove', svc: 'deletePart',
    row: /<td><div class="row-actions">\s*@if \(can\(\)\.receiveParts\)[\s\S]*?<\/div><\/td>/,
    rep: `<td><app-row-actions [canEdit]="can().editPart" [canDelete]="can().deletePart" [deleting]="deletingId() === p.id" (edit)="openForm(p)" (remove)="remove(p)">
                @if (can().receiveParts) { <button class="btn btn-sm" type="button" (click)="stock.set({ part: p, mode: 'receive' })">إدخال</button> }
                @if (can().adjustParts) { <button class="btn btn-ghost btn-sm" type="button" (click)="stock.set({ part: p, mode: 'adjust' })">تسوية</button> }
                <button class="btn btn-ghost btn-sm" type="button" (click)="movements.set(p)">الحركات</button>
              </app-row-actions></td>`
  },
  {
    ts: 'maintenance/pages/tasks-page.ts', html: 'maintenance/pages/tasks-page.html', v: 't', method: 'askDelete', svc: 'deleteTask',
    row: /<td \(click\)="\$event\.stopPropagation\(\)"><div class="row-actions">[\s\S]*?<\/div><\/td>/,
    rep: `<td (click)="$event.stopPropagation()"><app-row-actions [canDelete]="can().deleteTask && t.canDelete" [deleting]="deletingId() === t.id" (remove)="askDelete(t)">
                @if (can().assignTask && t.canAssign) { <button class="btn btn-ghost btn-sm" type="button" (click)="assigning.set(t)">نقل</button> }
              </app-row-actions></td>`
  },
  {
    ts: 'devices/pages/installations-page.ts', html: 'devices/pages/installations-page.html', v: 'i', method: 'askDelete', svc: 'deleteInstallation',
    row: /<td><div class="row-actions">\s*@if \(access\(\)\.canEdit\) \{ <button class="btn btn-ghost btn-sm" type="button" \(click\)="verify\(i\)"[\s\S]*?<\/div><\/td>/,
    rep: `<td><app-row-actions [canEdit]="access().canEdit" [canDelete]="access().canDelete" [deleting]="deletingId() === i.id" (edit)="openForm(i)" (remove)="askDelete(i)">
                @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="verify(i)" title="تأكيد أن بيانات التركيب صحيحة اليوم">✓ تحققت</button> }
                <button class="btn btn-ghost btn-sm" type="button" (click)="history.set(i)">السجل</button>
              </app-row-actions></td>`
  }
];

for (const p of pages) {
  let h = fs.readFileSync(F + p.html, 'utf8');
  h = rx(h, p.row, p.rep);
  fs.writeFileSync(F + p.html, h);

  let t = fs.readFileSync(F + p.ts, 'utf8');
  // مؤشر الحذف على الصف
  t = rx(t, new RegExp(`(  async ${p.method}\\((\\w+): [^)]*\\) \\{[\\s\\S]*?)    this\\.service\\.${p.svc}\\(`), (m, head, v) => `${head}    this.deletingId.set(${v}.id);\n    this.service.${p.svc}(`);
  t = rx(t, new RegExp(`(this\\.service\\.${p.svc}\\([^)]*\\)\\.subscribe\\(\\{\\n      next: (?:\\w+|\\(\\)) => \\{ )`), '$1this.deletingId.set(null); ');
  t = rx(t, new RegExp(`(this\\.service\\.${p.svc}\\([\\s\\S]*?\\n      error: e => )this\\.toast\\.error\\(e\\.message\\)`), '$1{ this.deletingId.set(null); this.toast.error(e.message); }');
  // الإشارة + الاستيراد
  t = rx(t, /(export class \w+ \{\n)/, '$1  /** السجل الجاري حذفه (مؤشر على صفه) */\n  deletingId = signal<number | null>(null);\n');
  t = t.replace(/^(import [^\n]*\n)/m, "$1import { RowActions } from '@shared/ui/row-actions';\n");
  t = rx(t, /imports: \[/, 'imports: [RowActions, ');
  if (!/\bsignal\b/.test(t.split('\n').filter(l => l.startsWith('import {') && l.includes('@angular/core')).join(''))) {
    t = t.replace(/import \{([^}]*)\} from '@angular\/core';/, (m, list) => `import {${list.trimEnd()}, signal } from '@angular/core';`);
  }
  fs.writeFileSync(F + p.ts, t);
  console.log('updated', p.ts);
}
