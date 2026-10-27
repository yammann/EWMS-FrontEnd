import { GanttTaskInput, dayIndex, layoutGantt } from './gantt';

const task = (id: number, start: string, end: string, extra: Partial<GanttTaskInput> = {}): GanttTaskInput => ({
  id, plannedStart: start, plannedEnd: end, originalStart: null, originalEnd: null, progress: 0, ...extra
});

describe('Gantt layout', () => {
  it('reads dates without the time zone', () => {
    expect(dayIndex('2026-11-02') - dayIndex('2026-11-01')).toBe(1);
    expect(dayIndex('2026-11-01T00:00:00')).toBe(dayIndex('2026-11-01'));
  });

  it('runs time from right to left: the earlier task sits further right', () => {
    const layout = layoutGantt([task(1, '2026-11-01', '2026-11-05'), task(2, '2026-11-10', '2026-11-12')], [], { pxPerDay: 10 });
    const [first, second] = layout.bars;
    expect(first.x + first.width).toBeGreaterThan(second.x + second.width);   // البداية الأقدم أقرب لليمين
    expect(second.x).toBeLessThan(first.x);                                   // النهاية الأحدث أقرب لليسار
    expect(first.width).toBe(50);                                              // 5 أيام شاملة الطرفين
    expect(second.width).toBe(30);
  });

  it('keeps every bar inside the drawing', () => {
    const layout = layoutGantt([task(1, '2026-11-01', '2026-12-31')], [], { pxPerDay: 8, padDays: 2 });
    const [bar] = layout.bars;
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(layout.width);
  });

  it('fills the progress from the start side (right edge)', () => {
    const [bar] = layoutGantt([task(1, '2026-11-01', '2026-11-10', { progress: 40 })], [], { pxPerDay: 10 }).bars;
    expect(bar.width).toBe(100);
    expect(bar.progressWidth).toBe(40);
    const [none, full] = layoutGantt([task(1, '2026-11-01', '2026-11-10', { progress: -5 }), task(2, '2026-11-01', '2026-11-10', { progress: 150 })], [], { pxPerDay: 10 }).bars;
    expect(none.progressWidth).toBe(0);
    expect(full.progressWidth).toBe(100);
  });

  it('draws a baseline bar only after the current dates moved away from the originals', () => {
    const same = task(1, '2026-11-01', '2026-11-10', { originalStart: '2026-11-01T00:00:00', originalEnd: '2026-11-10T00:00:00' });
    const extended = task(2, '2026-11-01', '2026-11-15', { originalStart: '2026-11-01', originalEnd: '2026-11-10' });
    const [a, b] = layoutGantt([same, extended], [], { pxPerDay: 10 }).bars;
    expect(a.baseX).toBeNull();
    expect(b.baseWidth).toBe(100);                // الأصل 10 أيام
    expect(b.width).toBe(150);                    // الحالي 15 يوماً
    expect(b.x).toBeLessThan(b.baseX!);           // التمديد يمتد يساراً والبداية ثابتة
    expect(b.x + b.width).toBe(b.baseX! + b.baseWidth!);
  });

  it('connects the end of the predecessor to the start of the successor and flags conflicts', () => {
    const layout = layoutGantt(
      [task(1, '2026-11-01', '2026-11-05'), task(2, '2026-11-06', '2026-11-09')],
      [{ id: 7, predecessorId: 1, successorId: 2, hasConflict: false }, { id: 8, predecessorId: 2, successorId: 1, hasConflict: true }, { id: 9, predecessorId: 1, successorId: 99, hasConflict: false }],
      { pxPerDay: 10 });
    expect(layout.arrows.map(a => a.id)).toEqual([7, 8]);                    // ما يشير إلى بند غير معروض يُهمل
    expect(layout.arrows[0].path.startsWith(`M${layout.bars[0].x},`)).toBe(true);
    expect(layout.arrows[0].conflict).toBe(false);
    expect(layout.arrows[1].conflict).toBe(true);
  });

  it('marks the months and the day today only when it falls inside the range', () => {
    const layout = layoutGantt([task(1, '2026-10-20', '2026-12-10')], [], { pxPerDay: 10, today: '2026-11-15' });
    expect(layout.ticks.map(t => t.label)).toEqual(['تشرين الثاني 2026', 'كانون الأول 2026']);
    expect(layout.todayX).not.toBeNull();
    expect(layoutGantt([task(1, '2026-10-20', '2026-12-10')], [], { pxPerDay: 10, today: '2027-05-01' }).todayX).toBeNull();
  });

  it('handles an empty schedule', () => {
    const layout = layoutGantt([], [], { pxPerDay: 10 });
    expect(layout.bars).toEqual([]);
    expect(layout.width).toBe(0);
  });
});
