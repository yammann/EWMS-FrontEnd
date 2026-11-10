import { ProjectStage, StageTask } from '../data-access/studies.models';
import {
  FOOT_H, HEAD_H, ROW_H, Row, axisRange, buildRows, dateText, dayWidth, fridayXs, monthBands, placeRows, rightEdge, splitLatinTail, toDay,
  visibleRows, weekTicks
} from './gantt-layout';

/** كل الأيام ثابتة (لا ساعة نظام): اليوم المفروض 2026-11-10 */
const TODAY = toDay('2026-11-10')!;
const d = (iso: string) => toDay(iso)!;

const stage = (id: number, over: Partial<ProjectStage> = {}): ProjectStage => ({
  id, projectId: 1, stageTypeId: id, stageTypeName: 'مرحلة ' + id, linkedDocument: 0, sortOrder: id, weight: 10,
  plannedStartDate: '2026-11-01', plannedEndDate: '2026-11-30', actualStartDate: null, actualEndDate: null, status: 2, statusName: 'قيد التنفيذ', progress: 40,
  responsibleDepartmentId: 1, responsibleDepartmentName: 'قسم أ', closedByName: null, closedAt: null, tasksTotal: 0, tasksDone: 0, rowVersion: 'x', canAddTask: false, ...over
} as ProjectStage);
const task = (id: number, stageId: number, over: Partial<StageTask> = {}): StageTask => ({
  id, stageId, targetTypeName: 'قسم', targetName: 'قسم أ', title: 'مهمة ' + id, plannedStartDate: '2026-11-02', plannedEndDate: '2026-11-20',
  progress: 20, status: 2, statusName: 'قيد التنفيذ', ...over
} as StageTask);

describe('toDay', () => {
  it('turns a date into whole days without time-zone drift, and tolerates empty values', () => {
    expect(toDay('2026-11-10')! - toDay('2026-11-09')!).toBe(1);
    expect(toDay('2026-11-10T23:59:59')).toBe(toDay('2026-11-10'));
    expect(toDay(null)).toBeNull();
    expect(toDay('')).toBeNull();
  });
});

describe('buildRows', () => {
  it('builds milestones for document stages, then a stage row followed by its tasks', () => {
    const rows = buildRows([stage(1, { linkedDocument: 2, status: 3 }), stage(2)], [task(10, 2), task(11, 2)], TODAY);
    expect(rows.map(r => r.kind)).toEqual(['milestone', 'stage', 'task', 'task']);
    expect(rows[1]).toMatchObject({ hasTasks: true, taskCount: 2, state: 'active' });
  });

  it('classifies late, todo and closed states against the given day', () => {
    const rows = buildRows(
      [stage(1, { plannedEndDate: '2026-11-05', progress: 30 }), stage(2, { status: 1, progress: 0, plannedEndDate: '2026-12-31' }), stage(3, { status: 3, progress: 100 })],
      [task(10, 1, { plannedEndDate: '2026-11-08', status: 2 })], TODAY);
    expect(rows.map(r => r.state)).toEqual(['late', 'late', 'todo', 'closed']);
    expect(rows[0].lateDays).toBe(d('2026-11-10') - d('2026-11-05'));
  });
});

describe('visibleRows', () => {
  const all = buildRows([stage(1, { linkedDocument: 1, status: 3 }), stage(2, { responsibleDepartmentName: 'قسم أ', plannedEndDate: '2026-11-01' }), stage(3, { responsibleDepartmentName: 'قسم ب' })],
    [task(10, 2, { plannedEndDate: '2026-11-02' }), task(11, 2), task(12, 3)], TODAY);
  const none = { dept: '', lateOnly: false, collapsed: new Set<number>(), tasksVisible: true };

  it('shows everything without filters', () => {
    expect(visibleRows(all, none).map(r => r.key)).toEqual(['s1', 's2', 't10', 't11', 's3', 't12']);
  });
  it('hides the tasks of a collapsed stage, or all tasks when they are not visible', () => {
    expect(visibleRows(all, { ...none, collapsed: new Set([2]) }).map(r => r.key)).toEqual(['s1', 's2', 's3', 't12']);
    expect(visibleRows(all, { ...none, tasksVisible: false }).map(r => r.key)).toEqual(['s1', 's2', 's3']);
  });
  it('filters by department with its tasks and drops the milestones', () => {
    expect(visibleRows(all, { ...none, dept: 'قسم ب' }).map(r => r.key)).toEqual(['s3', 't12']);
  });
  it('keeps late stages with only their late tasks', () => {
    expect(visibleRows(all, { ...none, lateOnly: true }).map(r => r.key)).toEqual(['s2', 't10']);
  });
});

describe('axisRange and dayWidth', () => {
  const rows = [{ start: d('2026-11-01'), end: d('2026-11-30') }] as Row[];
  it('spans the earliest to the latest date with a margin and includes a near today', () => {
    const r = axisRange(rows, null, null, TODAY)!;
    expect(r.min).toBe(d('2026-11-01') - 3);
    expect(r.max).toBe(d('2026-11-30') + 3);
    expect(r.span).toBe(r.max - r.min + 1);
    expect(axisRange([], null, null, TODAY)).toBeNull();
  });
  it('widens the axis to the project dates and ignores a today that is far away', () => {
    const r = axisRange(rows, d('2026-10-01'), d('2026-12-31'), d('2030-01-01'))!;
    expect(r.min).toBe(d('2026-10-01') - 3);
    expect(r.max).toBe(d('2026-12-31') + 3);
  });
  it('uses the zoom width, or fits the paper when printing', () => {
    expect(dayWidth('month', 100, null, false)).toBe(10);
    expect(dayWidth('week', 100, 840, true)).toBe(8);
    expect(dayWidth('quarter', 1000, 840, true)).toBe(2);
  });
});

describe('placeRows', () => {
  const range = { min: d('2026-11-01'), max: d('2026-11-30'), span: 30 };
  const W = 30 * 10;
  it('stacks rows under the header and places the bar from its start with the progress inside', () => {
    const rows = buildRows([stage(1, { plannedStartDate: '2026-11-01', plannedEndDate: '2026-11-30', progress: 50 })], [task(10, 1)], TODAY);
    const placed = placeRows(rows, range, W, 10);
    expect(placed[0].y).toBe(HEAD_H);
    expect(placed[1].y).toBe(HEAD_H + ROW_H.stage);
    expect(placed[0].right).toBe(rightEdge(range, W, 10, d('2026-11-01')));
    expect(placed[0].w).toBe(300);
    expect(placed[0].fillW).toBe(150);
    expect(placed[0].pct).toMatchObject({ text: '50%', onFill: true });
    expect(HEAD_H + placed.reduce((s, p) => s + p.h, 0) + FOOT_H).toBeGreaterThan(0);
  });
  it('omits the percent when the bar is too narrow and centers a milestone on its day', () => {
    const narrow = placeRows(buildRows([stage(1, { plannedStartDate: '2026-11-05', plannedEndDate: '2026-11-06', progress: 60 })], [], TODAY), range, W, 10);
    expect(narrow[0].pct).toBeNull();
    const ms = placeRows(buildRows([stage(1, { linkedDocument: 1, plannedStartDate: '2026-11-05' })], [], TODAY), range, W, 10);
    expect(ms[0].right).toBe(rightEdge(range, W, 10, d('2026-11-05')) - 5);
  });
});

describe('axis bands', () => {
  const range = { min: d('2026-11-25'), max: d('2026-12-10'), span: 16 };
  it('splits the axis into month bands and names the year on the first band and on January', () => {
    const bands = monthBands(range, 160, 10);
    expect(bands).toHaveLength(2);
    expect(bands[0].w + bands[1].w).toBe(160);
    expect(bands[0].text).toContain('2026');
    expect(bands[1].text).not.toContain('2026');
  });
  it('marks Sundays as week ticks and Fridays for shading', () => {
    const weeks = weekTicks(range, 160, 10);
    expect(weeks.map(w => w.text)).toEqual(['29', '6']);
    const fridays = fridayXs(range, 160, 10);
    expect(fridays).toEqual([d('2026-11-27'), d('2026-12-04')].map(day => rightEdge(range, 160, 10, day) - 10));
  });
});

describe('labels', () => {
  it('splits a trailing Latin tail only', () => {
    expect(splitLatinTail('التصميم المعماري (Concept)')).toEqual({ head: 'التصميم المعماري', tail: '(Concept)' });
    expect(splitLatinTail('النمذجة BIM وكشف')).toEqual({ head: 'النمذجة BIM وكشف', tail: '' });
  });
  it('describes the period of a row', () => {
    const row = (over: Partial<Row>) => ({ kind: 'stage', start: d('2026-11-01'), end: d('2026-11-10'), ...over }) as Row;
    expect(dateText(row({ start: null }))).toBe('بلا تاريخ');
    expect(dateText(row({ kind: 'milestone', end: null }))).not.toContain('←');
    expect(dateText(row({}))).toContain('←');
    expect(dateText(row({ end: d('2026-11-01') }))).not.toContain('←');
  });
});
