/**
 * مخطط غانت: حساب مواضع الأشرطة فقط (بلا DOM) فيُختبر وحده ويرسمه schedule-gantt بـ SVG.
 * الزمن يجري من اليمين إلى اليسار (واجهة عربية): أقدم تاريخ عند اليمين، والنهاية عند اليسار.
 * شريط البند [بداية، نهاية] شامل للطرفين، وعرضه (عدد الأيام × px لكل يوم).
 */
export interface GanttTaskInput {
  id: number; plannedStart: string; plannedEnd: string; originalStart: string | null; originalEnd: string | null;
  progress: number;
}
export interface GanttEdge { id: number; predecessorId: number; successorId: number; hasConflict: boolean; }
export interface GanttOptions {
  /** عرض اليوم الواحد بالبكسل */
  pxPerDay: number;
  rowHeight?: number; headerHeight?: number; barHeight?: number;
  /** أيام فارغة قبل أول تاريخ وبعد آخر تاريخ */
  padDays?: number;
  /** اليوم (yyyy-MM-dd) لخط «اليوم» */
  today?: string;
}

export interface GanttBar {
  id: number; row: number; y: number;
  /** الحافة اليسرى (النهاية) والعرض */
  x: number; width: number;
  /** عرض الجزء المنجز من الشريط، يبدأ من الحافة اليمنى (البداية) */
  progressWidth: number;
  /** شريط خط الأساس (التواريخ الأصلية) إن اختلفت عن الحالية */
  baseX: number | null; baseWidth: number | null;
  midY: number;
}
export interface GanttArrow { id: number; path: string; conflict: boolean; }
export interface GanttTick { x: number; label: string; }
export interface GanttLayout {
  width: number; height: number; rowHeight: number; headerHeight: number; barHeight: number;
  bars: GanttBar[]; arrows: GanttArrow[]; ticks: GanttTick[]; todayX: number | null;
}

const DAY_MS = 86_400_000;
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

/** رقم اليوم منذ 1970 لتاريخ «yyyy-MM-dd» (أو ISO يبدأ به): بلا أثر للمنطقة الزمنية */
export function dayIndex(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

const fromIndex = (day: number) => new Date(day * DAY_MS);

export function layoutGantt(tasks: readonly GanttTaskInput[], edges: readonly GanttEdge[], options: GanttOptions): GanttLayout {
  const px = options.pxPerDay;
  const rowHeight = options.rowHeight ?? 36;
  const headerHeight = options.headerHeight ?? 34;
  const barHeight = options.barHeight ?? 16;
  const pad = options.padDays ?? 3;

  if (tasks.length === 0) {
    return { width: 0, height: headerHeight, rowHeight, headerHeight, barHeight, bars: [], arrows: [], ticks: [], todayX: null };
  }

  const starts = tasks.flatMap(t => [dayIndex(t.plannedStart), t.originalStart ? dayIndex(t.originalStart) : Infinity]);
  const ends = tasks.flatMap(t => [dayIndex(t.plannedEnd), t.originalEnd ? dayIndex(t.originalEnd) : -Infinity]);
  const minDay = Math.min(...starts) - pad;
  const maxDay = Math.max(...ends) + pad;
  const width = (maxDay - minDay + 1) * px;

  // x للحافة اليسرى من يوم «بعد النهاية»: التاريخ الأحدث أبعد إلى اليسار
  const edgeLeft = (dayAfterEnd: number) => width - (dayAfterEnd - minDay) * px;
  const spanOf = (start: number, end: number) => ({ x: edgeLeft(end + 1), width: (end - start + 1) * px });

  const bars: GanttBar[] = tasks.map((t, row) => {
    const span = spanOf(dayIndex(t.plannedStart), dayIndex(t.plannedEnd));
    const y = headerHeight + row * rowHeight + (rowHeight - barHeight) / 2;
    let baseX: number | null = null, baseWidth: number | null = null;
    if (t.originalStart && t.originalEnd && (t.originalStart.slice(0, 10) !== t.plannedStart.slice(0, 10) || t.originalEnd.slice(0, 10) !== t.plannedEnd.slice(0, 10))) {
      const base = spanOf(dayIndex(t.originalStart), dayIndex(t.originalEnd));
      baseX = base.x; baseWidth = base.width;
    }
    return {
      id: t.id, row, y, x: span.x, width: span.width, baseX, baseWidth,
      progressWidth: Math.round(span.width * Math.min(100, Math.max(0, t.progress))) / 100,
      midY: y + barHeight / 2
    };
  });

  const byId = new Map(bars.map(b => [b.id, b]));
  const arrows: GanttArrow[] = [];
  for (const e of edges) {
    const from = byId.get(e.predecessorId), to = byId.get(e.successorId);
    if (!from || !to) continue;
    // من نهاية السابق (حافته اليسرى) إلى بداية اللاحق (حافته اليمنى)
    const sx = from.x, sy = from.midY, tx = to.x + to.width, ty = to.midY;
    arrows.push({ id: e.id, path: `M${sx},${sy} H${sx - 6} V${ty} H${tx}`, conflict: e.hasConflict });
  }

  const ticks: GanttTick[] = [];
  const first = fromIndex(minDay);
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); ; m++) {
    if (m > 11) { m = 0; y++; }
    const day = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
    if (day > maxDay) break;
    if (day < minDay) continue;
    ticks.push({ x: edgeLeft(day + 1) + px, label: `${MONTHS[m]} ${y}` });
  }

  let todayX: number | null = null;
  if (options.today) {
    const today = dayIndex(options.today);
    if (today >= minDay && today <= maxDay) todayX = edgeLeft(today + 1) + px / 2;
  }

  return { width, height: headerHeight + tasks.length * rowHeight, rowHeight, headerHeight, barHeight, bars, arrows, ticks, todayX };
}
