// تحميل القوائم والصفحات عبر latestRequest: كل تحميل يلغي السابق، فلا يستبدل ردٌّ متأخر (شبكة بطيئة) النتيجةَ الأحدث.
// trackRequest يبقى للعمليات المفردة (حفظ، حذف، إرسال).
import fs from 'node:fs';

const F = 'src/app/features/';
// [الملف، اسم الصنف (null = الصنف الوحيد/الأول)، بدايات استدعاءات التحميل]
const targets = [
  ['dashboard/pages/branch-dashboard.ts', null, ['this.service.branch(']],
  ['dashboard/pages/department-dashboard.ts', null, ['this.service.department(']],
  ['dashboard/pages/employee-dashboard.ts', null, ['this.service.me(']],
  ['dashboard/pages/office-dashboard.ts', null, ['this.service.office(']],
  ['dashboard/pages/overview-dashboard.ts', null, ['this.service.overview(']],
  ['devices/components/device-ui.ts', 'DeviceHistory', ['this.service.history(']],
  ['devices/pages/installations-page.ts', null, ['this.service.installations(']],
  ['maintenance/pages/devices-page.ts', null, ['this.service.devices(']],
  ['maintenance/pages/my-requests-page.ts', null, ['this.service.myRequests(']],
  ['maintenance/pages/spare-parts-page.ts', null, ['this.service.parts(']],
  ['maintenance/pages/spare-parts-report-page.ts', null, ['this.service.partReport(']],
  ['maintenance/pages/stats-page.ts', null, ['this.service.stats(']],
  ['maintenance/pages/tasks-page.ts', null, ['this.service.tasks(']],
  ['maintenance/components/spare-part-dialogs.ts', 'SparePartMovements', ['this.service.partMovements(']],
  ['map/components/branch-map.ts', null, ['this.service.branchMap(']],
  ['profile/pages/profile-page.ts', null, ['this.service.mine(']],
  ['task-board/pages/task-stats-page.ts', null, ['this.service.stats(']],
  ['todo/pages/todo-lists-page.ts', null, ['this.service.lists(']],
  ['vacations/components/vacation-context-panel.ts', null, ['this.service.approvalContext(']],
  ['vacations/pages/vacation-review-page.ts', null, ['this.service.pending(']],
  ['vacations/pages/vacation-stats-page.ts', null, ['this.service.vacations(']],
];

const FIELD = '  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */\n  private latest = latestRequest();\n';

for (const [file, cls, calls] of targets) {
  let s = fs.readFileSync(F + file, 'utf8');
  for (const call of calls) {
    const a = 'trackRequest(' + call;
    if (!s.includes(a)) throw new Error(`${file}: missing ${a}`);
    s = s.split(a).join('this.latest(' + call);
  }
  // الحقل في أول سطر داخل الصنف
  const classRe = cls ? new RegExp(`(export class ${cls}\\b[^{]*\\{\\n)`) : /(export class \w+\b[^{]*\{\n)/;
  if (!classRe.test(s)) throw new Error(`${file}: class not found`);
  s = s.replace(classRe, `$1${FIELD}`);
  // الاستيراد: latestRequest، وtrackRequest فقط إن بقي مستعملاً
  const importRe = /import \{ ([^}]*) \} from '([^']*track-request)';/;
  const m = s.match(importRe);
  if (!m) throw new Error(`${file}: track-request import not found`);
  const stillTrack = s.replace(importRe, '').includes('trackRequest(');
  const names = ['latestRequest', ...(stillTrack ? ['trackRequest'] : [])];
  s = s.replace(importRe, `import { ${names.join(', ')} } from '${m[2]}';`);
  fs.writeFileSync(F + file, s);
  console.log('ok', file, stillTrack ? '(+trackRequest)' : '');
}
