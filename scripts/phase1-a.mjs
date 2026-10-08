import fs from 'node:fs';
import path from 'node:path';
import { retarget, root } from './codemod-move.mjs';

// 1) StatTile + StatTone → shared/ui/stat-tile.ts
const wf = path.join(root, 'features/dashboard/dashboard-widgets.ts');
let w = fs.readFileSync(wf, 'utf8');
const a = w.indexOf("export type StatTone");
const b = w.indexOf('/** بطاقات مهام العمل');
const block = w.slice(a, b);
w = w.slice(0, a) + w.slice(b);
fs.writeFileSync(wf, w);
fs.writeFileSync(path.join(root, 'shared/ui/stat-tile.ts'),
  "import { Component, input } from '@angular/core';\n\n" + block.trimEnd() + '\n');
console.log('StatTile imports', retarget(['StatTile', 'StatTone'], s => /dashboard-widgets$/.test(s), '@shared/ui/stat-tile'));
// الملف نفسه يستعمل StatTile؟
if (/StatTile|StatTone/.test(w)) console.log('widgets still reference StatTile — add import');

// 2) Pager من maintenance-ui → shared/ui/pager
console.log('Pager imports', retarget(['Pager'], s => /maintenance-ui$/.test(s), '@shared/ui/pager'));

// 3) fileSize → core/utils/file-size.ts
const vf = path.join(root, 'features/vacations/vacation-attachments.ts');
let v = fs.readFileSync(vf, 'utf8');
const m = /export function fileSize\(bytes: number\) \{[\s\S]*?\n\}\n/.exec(v);
if (!m) throw new Error('fileSize');
fs.writeFileSync(path.join(root, 'core/utils/file-size.ts'), m[0].replace(/^export function/, 'export function'));
v = v.replace(m[0], '');
fs.writeFileSync(vf, v);
console.log('fileSize imports', retarget(['fileSize'], s => /vacation-attachments$/.test(s), '@core/utils/file-size'));

// 4) vacationDateRange → features/vacations/vacation-validators.ts
const pf = path.join(root, 'features/profile/profile-page.ts');
let p = fs.readFileSync(pf, 'utf8');
const r = /export function vacationDateRange\(control: AbstractControl\) \{[\s\S]*?\n\}\n/.exec(p);
if (!r) throw new Error('vacationDateRange');
fs.writeFileSync(path.join(root, 'features/vacations/vacation-validators.ts'), "import { AbstractControl } from '@angular/forms';\n\n" + r[0]);
p = p.replace(r[0], '');
fs.writeFileSync(pf, p);
console.log('vdr imports', retarget(['vacationDateRange'], s => /profile-page$/.test(s), '@features/vacations/vacation-validators'));
