import { ProjectStage } from '../data-access/studies.models';
import { currentStage, daysLeft, daysLeftText, isProjectLate, stageStrip } from './project-card';

const now = new Date(2026, 10, 16, 15, 30);           // 2026/11/16 بعد الظهر — التواريخ تُقارن باليوم لا بالساعة
const stage = (id: number, over: Partial<ProjectStage>): ProjectStage => ({
  id, projectId: 1, stageTypeId: id, stageTypeName: 'مرحلة ' + id, linkedDocument: 0, sortOrder: id, weight: 10,
  plannedStartDate: null, plannedEndDate: null, actualStartDate: null, actualEndDate: null,
  status: 1, statusName: '', progress: 0, responsibleDepartmentId: null, responsibleDepartmentName: null,
  closedByName: null, closedAt: null, tasksTotal: 0, tasksDone: 0, rowVersion: 'x', canAddTask: false, ...over
} as ProjectStage);

describe('project card', () => {
  it('a running project is late only after its planned end day, while below 100%', () => {
    expect(isProjectLate({ status: 1, plannedEndDate: '2026-11-15', progress: 40 }, now)).toBe(true);
    expect(isProjectLate({ status: 1, plannedEndDate: '2026-11-16T00:00:00', progress: 40 }, now)).toBe(false);
    expect(isProjectLate({ status: 1, plannedEndDate: '2026-11-15', progress: 100 }, now)).toBe(false);
    expect(isProjectLate({ status: 2, plannedEndDate: '2026-01-01', progress: 10 }, now)).toBe(false);
  });

  it('counts the days left for running projects only', () => {
    expect(daysLeft({ status: 1, plannedEndDate: '2026-11-28' }, now)).toBe(12);
    expect(daysLeft({ status: 1, plannedEndDate: '2026-11-11' }, now)).toBe(-5);
    expect(daysLeft({ status: 3, plannedEndDate: '2026-11-28' }, now)).toBeNull();
    expect(daysLeftText(12)).toBe('باقٍ 12 يوماً');
    expect(daysLeftText(2)).toBe('باقٍ يومين');
    expect(daysLeftText(-5)).toBe('متأخر 5 أيام');
    expect(daysLeftText(0)).toBe('ينتهي اليوم');
    expect(daysLeftText(null)).toBe('');
  });

  it('strips document stages, keeps order, and marks overdue open stages as late', () => {
    const strip = stageStrip([
      stage(3, { status: 2, plannedEndDate: '2026-11-10' }),
      stage(1, { linkedDocument: 4, status: 3 }),
      stage(2, { status: 3, progress: 100 }),
      stage(4, { status: 2, plannedEndDate: '2026-12-01' }),
      stage(5, {})
    ], now);
    expect(strip.map(s => [s.id, s.state])).toEqual([[2, 'closed'], [3, 'late'], [4, 'active'], [5, 'todo']]);
    expect(currentStage(strip)?.id).toBe(3);
    expect(currentStage(strip.filter(s => s.state === 'closed'))).toBeNull();
  });
});
