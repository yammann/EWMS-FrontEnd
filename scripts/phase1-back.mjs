// يضيف data.back للمسارات التفصيلية/الفرعية (وجهة زر الرجوع الموحّد)
import fs from 'node:fs';

const file = 'src/app/app.routes.ts';
let s = fs.readFileSync(file, 'utf8');
const BACK = {
  'maintenance/print/:id/:kind': '/maintenance/requests',
  'vacations/print/:id': '/profile',
  'dashboard/branch/:id': '/',
  'dashboard/department/:id': '/',
  'dashboard/office/:id': '/',
  'tasks/:id': '/',
  'todo-lists/:id': '/todo-lists',
  'task-board/recurring': '/task-board',
  'task-board/stats': '/task-board',
  'sites/:id': '/devices/sites',
  'requests/:id': '/maintenance/requests',
  'parts/report': '/maintenance/parts'
};
for (const [p, b] of Object.entries(BACK)) {
  const start = s.indexOf(`path: '${p}'`);
  if (start < 0) throw new Error('route ' + p);
  const lineEnd = s.indexOf('\n', start);
  let chunk = s.slice(start, lineEnd);
  // نفس السطر فيه data؟ وإلا السطر التالي (مسارات متعددة الأسطر)
  const probe = (c) => /data: \{ [^}]* \}/.test(c);
  let segStart = start, segEnd = lineEnd;
  if (!probe(chunk)) { const next = s.indexOf('\n', lineEnd + 1); segEnd = next; chunk = s.slice(start, segEnd); }
  if (probe(chunk)) chunk = chunk.replace(/data: \{ ([^}]*) \}/, `data: { $1, back: '${b}' }`);
  else chunk = chunk.replace(`path: '${p}',`, `path: '${p}', data: { back: '${b}' },`);
  s = s.slice(0, segStart) + chunk + s.slice(segEnd);
}
fs.writeFileSync(file, s);
console.log((s.match(/back: '/g) || []).length, 'routes annotated');
