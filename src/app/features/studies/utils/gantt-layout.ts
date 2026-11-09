import { ProjectStage, StageTask } from '../data-access/studies.models';

/**
 * حسابات مخطط Gantt الخالصة (بلا Angular): الصفوف من المراحل والمهام، الفلاتر والطي، مدى المحور، المواضع، الشهور والأسابيع.
 * المكوّن StudyGantt يحمل الإشارات والرسم فقط، وهنا كل ما يُختبر بأيام ثابتة بلا ساعة النظام.
 */

export const DAY = 86_400_000;
/** عرض اليوم بالبكسل لكل مستوى تكبير: أسبوع (مقرّب)، شهر، ربع (مبعَّد) */
export const ZOOM_W = { week: 28, month: 10, quarter: 4 } as const;
export type Zoom = keyof typeof ZOOM_W;
export const HEAD_H = 52;
export const FOOT_H = 30;
export const ROW_H = { milestone: 28, stage: 36, task: 28 } as const;
/** أقل عرض شريط يتسع لنسبة الإنجاز داخله */
const MIN_PERCENT_W = 34;

export type RowKind = 'milestone' | 'stage' | 'task';
export type BarState = 'closed' | 'active' | 'todo' | 'late';

export interface Row {
  key: string; kind: RowKind; stageId: number; label: string; sub: string; dept: string; statusName: string;
  start: number | null; end: number | null; progress: number; state: BarState; lateDays: number; hasTasks: boolean; taskCount: number;
}
export interface Placed extends Row {
  y: number; h: number; cy: number;
  /** الشريط: الحافة اليمنى (الأبكر)، العرض، عرض الإنجاز */
  right: number; w: number; fillW: number;
  /** نسبة الإنجاز داخل الشريط (إن اتسع) */
  pct: { x: number; text: string; onFill: boolean } | null;
}
export interface Month { x: number; w: number; text: string; }
export interface Tick { x: number; text: string; }
export interface AxisRange { min: number; max: number; span: number; }

/** التاريخ (yyyy-MM-dd) كعدد أيام من 1970 بلا انزياح المناطق */
export const toDay = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const todayDay = () => { const n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY); };

const LOCALE = 'ar-SY-u-ca-gregory-nu-latn';
const monthName = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' });
export const fmtDay = (d: number) => dayMonth.format(new Date(d * DAY));

/** كل الصفوف قبل الطي والفلاتر: معلم لكل مرحلة مستند، مرحلة عمل ثم مهامها */
export function buildRows(stages: readonly ProjectStage[], tasks: readonly StageTask[], today: number): Row[] {
  const byStage = new Map<number, StageTask[]>();
  for (const t of tasks) (byStage.get(t.stageId) ?? byStage.set(t.stageId, []).get(t.stageId)!).push(t);
  const rows: Row[] = [];
  for (const s of stages) {
    const stageTasks = byStage.get(s.id) ?? [];
    const dept = s.responsibleDepartmentName ?? '';
    if (s.linkedDocument) {
      rows.push({
        key: 's' + s.id, kind: 'milestone', stageId: s.id, label: s.stageTypeName, sub: '', dept, statusName: s.statusName,
        start: toDay(s.plannedStartDate) ?? toDay(s.actualStartDate) ?? toDay(s.plannedEndDate), end: null, progress: 100, state: 'closed', lateDays: 0, hasTasks: false, taskCount: 0
      });
      continue;
    }
    const end = toDay(s.plannedEndDate);
    const late = s.status !== 3 && end != null && end < today && s.progress < 100;
    rows.push({
      key: 's' + s.id, kind: 'stage', stageId: s.id, label: s.stageTypeName, sub: dept, dept, statusName: s.statusName,
      start: toDay(s.plannedStartDate), end, progress: s.progress,
      state: s.status === 3 ? 'closed' : late ? 'late' : s.progress > 0 || s.status === 2 ? 'active' : 'todo',
      lateDays: late && end != null ? today - end : 0, hasTasks: stageTasks.length > 0, taskCount: stageTasks.length
    });
    for (const t of stageTasks) {
      const e = toDay(t.plannedEndDate);
      const tl = t.status !== 3 && e != null && e < today;
      rows.push({
        key: 't' + t.id, kind: 'task', stageId: s.id, label: t.title, sub: `${t.targetTypeName}: ${t.targetName}`, dept, statusName: t.statusName,
        start: toDay(t.plannedStartDate), end: e, progress: t.progress,
        state: t.status === 3 ? 'closed' : tl ? 'late' : t.progress > 0 || t.status === 2 ? 'active' : 'todo',
        lateDays: tl && e != null ? today - e : 0, hasTasks: false, taskCount: 0
      });
    }
  }
  return rows;
}

export interface RowFilter { dept: string; lateOnly: boolean; collapsed: ReadonlySet<number>; tasksVisible: boolean; }

/**
 * الصفوف الظاهرة: الفلاتر ثم الطي. فلتر القسم يُبقي مراحل ذلك القسم بمهامها؛ و«المتأخر فقط» يُبقي المرحلة المتأخرة
 * أو التي فيها مهمة متأخرة (والمتأخر من مهامها). وأي فلتر فعّال يُخفي معالم المستندات ليتركّز العرض.
 */
export function visibleRows(all: readonly Row[], { dept, lateOnly, collapsed, tasksVisible }: RowFilter): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < all.length;) {
    const r = all[i];
    if (r.kind === 'milestone') { if (!dept && !lateOnly) out.push(r); i++; continue; }
    const tasks: Row[] = [];
    let j = i + 1;
    while (j < all.length && all[j].kind === 'task' && all[j].stageId === r.stageId) tasks.push(all[j++]);
    i = j;
    if (dept && r.dept !== dept) continue;
    const lateTasks = tasks.filter(t => t.state === 'late');
    if (lateOnly && r.state !== 'late' && !lateTasks.length) continue;
    out.push(r);
    if (!tasksVisible || collapsed.has(r.stageId)) continue;
    out.push(...(lateOnly ? lateTasks : tasks));
  }
  return out;
}

/** مدى المحور: أبكر تاريخ إلى أبعده (مع هامش)، ويشمل اليوم إن كان قريباً من المدى */
export function axisRange(rows: readonly Row[], projectStart: number | null, projectEnd: number | null, today: number): AxisRange | null {
  const days = rows.flatMap(r => [r.start, r.end]).concat([projectStart, projectEnd]).filter((d): d is number => d != null);
  if (!days.length) return null;
  let min = Math.min(...days) - 3, max = Math.max(...days) + 3;
  if (today >= min - 30 && today <= max + 30) { min = Math.min(min, today - 3); max = Math.max(max, today + 3); }
  return { min, max, span: Math.max(14, max - min + 1) };
}

/** عرض اليوم: من التكبير المختار، أو يُحسب ليتسع المحور في عرض الورقة عند الطباعة */
export function dayWidth(zoom: Zoom, span: number, fit: number | null, printMode: boolean): number {
  return fit && printMode ? Math.max(2, Math.min(14, Math.floor(fit / span))) : ZOOM_W[zoom];
}

/** الحافة اليمنى لخلية يوم (الزمن يجري يميناً ← يساراً) */
export const rightEdge = (range: AxisRange, width: number, dayW: number, day: number) => width - (day - range.min) * dayW;

/** مواضع الصفوف: ارتفاعها وشريط كل صف ونسبة إنجازه داخله إن اتسع */
export function placeRows(rows: readonly Row[], range: AxisRange, width: number, dayW: number): Placed[] {
  const xr = (day: number) => rightEdge(range, width, dayW, day);
  let y = HEAD_H;
  return rows.map(row => {
    const h = ROW_H[row.kind];
    const out: Placed = { ...row, y, h, cy: y + h / 2, right: 0, w: 0, fillW: 0, pct: null };
    y += h;
    if (row.start == null) return out;
    if (row.kind === 'milestone') { out.right = xr(row.start) - dayW / 2; return out; }
    const end = row.end ?? row.start;
    out.right = xr(row.start);
    out.w = Math.max(10, (Math.max(end, row.start) - row.start + 1) * dayW);
    out.fillW = row.state === 'closed' ? out.w : (out.w * Math.max(0, Math.min(100, row.progress))) / 100;
    // نسبة الإنجاز داخل الشريط: على التعبئة إن اتسعت، وإلا في الجزء الفارغ، وإلا لا شيء
    const text = `${Math.round(row.state === 'closed' ? 100 : row.progress)}%`;
    if (row.state !== 'todo' && row.progress + (row.state === 'closed' ? 100 : 0) > 0) {
      if (out.fillW >= MIN_PERCENT_W) out.pct = { x: out.right - 6, text, onFill: true };
      else if (out.w - out.fillW >= MIN_PERCENT_W) out.pct = { x: out.right - out.fillW - 6, text, onFill: false };
    }
    return out;
  });
}

/** شرائط الشهور فوق المحور (السنة تُذكر عند الشهر الأول وعند يناير) */
export function monthBands(range: AxisRange, width: number, dayW: number): Month[] {
  const out: Month[] = [];
  let d = range.min;
  while (d <= range.max) {
    const date = new Date(d * DAY);
    const next = Math.round(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY);
    const end = Math.min(next - 1, range.max);
    const first = out.length === 0 || date.getUTCMonth() === 0;
    out.push({ x: rightEdge(range, width, dayW, end) - dayW, w: (end - d + 1) * dayW, text: monthName.format(date) + (first ? ' ' + date.getUTCFullYear() : '') });
    d = end + 1;
  }
  return out;
}

/** بدايات الأسابيع (الأحد) برقم اليوم من الشهر */
export function weekTicks(range: AxisRange, width: number, dayW: number): Tick[] {
  const out: Tick[] = [];
  for (let d = range.min; d <= range.max; d++)
    if (new Date(d * DAY).getUTCDay() === 0) out.push({ x: rightEdge(range, width, dayW, d), text: String(new Date(d * DAY).getUTCDate()) });
  return out;
}

/** مواضع أيام الجمعة (عطلة أسبوعية) للتظليل */
export function fridayXs(range: AxisRange, width: number, dayW: number): number[] {
  const out: number[] = [];
  for (let d = range.min; d <= range.max; d++) if (new Date(d * DAY).getUTCDay() === 5) out.push(rightEdge(range, width, dayW, d) - dayW);
  return out;
}

/** يفصل الذيل اللاتيني الأخير («(Concept)» أو «BIM») عن بقية الاسم ليبقى كاملاً عند الاقتطاع */
export function splitLatinTail(label: string): { head: string; tail: string } {
  const m = /^(.*?)\s*(\([^()]*[A-Za-z][^()]*\)|[A-Za-z][A-Za-z0-9 .-]*)$/.exec(label);
  return m && m[1] ? { head: m[1], tail: m[2] } : { head: label, tail: '' };
}

/** نص فترة الصف: «بلا تاريخ» أو يوم واحد أو من ← إلى */
export function dateText(r: Row): string {
  if (r.start == null) return 'بلا تاريخ';
  if (r.kind === 'milestone' || r.end == null || r.end === r.start) return fmtDay(r.start);
  return `${fmtDay(r.start)} ← ${fmtDay(r.end)}`;
}
