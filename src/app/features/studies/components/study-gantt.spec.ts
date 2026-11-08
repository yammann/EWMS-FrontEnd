import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectStage, StageTask } from '../data-access/studies.models';
import { StudyGantt } from './study-gantt';

/** يوم نسبي إلى اليوم بصيغة yyyy-MM-dd */
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const stage = (id: number, over: Partial<ProjectStage> = {}): ProjectStage => ({
  id, projectId: 1, stageTypeId: id, stageTypeName: 'مرحلة ' + id, linkedDocument: 0, sortOrder: id, weight: 10,
  plannedStartDate: day(-20), plannedEndDate: day(10), actualStartDate: null, actualEndDate: null, status: 2, statusName: 'قيد التنفيذ', progress: 40,
  responsibleDepartmentId: 1, responsibleDepartmentName: 'قسم أ', closedByName: null, closedAt: null, tasksTotal: 0, tasksDone: 0, rowVersion: 'x', ...over
} as ProjectStage);
const task = (id: number, stageId: number, over: Partial<StageTask> = {}): StageTask => ({
  id, stageId, stageName: '', projectId: 1, projectCode: 'P', projectName: 'P', targetType: 1, targetTypeName: 'قسم', targetName: 'قسم أ', departmentId: 1, officeId: null, assigneeUserId: null,
  assignedByName: '', title: 'مهمة ' + id, description: null, plannedStartDate: day(-15), plannedEndDate: day(5), actualStartDate: null, actualEndDate: null,
  progress: 20, weight: 10, status: 2, statusName: 'قيد التنفيذ', createdAt: '', updatedAt: null, rowVersion: 'x', canEdit: false, canUpdateProgress: false, ...over
} as StageTask);

function setup(stages: ProjectStage[], tasks: StageTask[] = [], inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StudyGantt);
  fixture.componentRef.setInput('stages', stages);
  fixture.componentRef.setInput('tasks', tasks);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('StudyGantt', () => {
  const stages = [
    stage(1, { linkedDocument: 1, status: 3, statusName: 'مغلقة', progress: 100 }),
    stage(2, { responsibleDepartmentName: 'قسم أ' }),
    stage(3, { responsibleDepartmentName: 'قسم ب', plannedEndDate: day(-3), progress: 30 })   // متأخرة
  ];
  const tasks = [task(10, 2), task(11, 3, { plannedEndDate: day(-2) }), task(12, 3)];

  it('shows document stages as milestones, and work stages with their tasks', () => {
    const g = setup(stages, tasks);
    expect(g.rows().map(r => r.kind)).toEqual(['milestone', 'stage', 'task', 'stage', 'task', 'task']);
  });

  it('marks a stage late only when its end passed with progress left', () => {
    const g = setup(stages, tasks);
    const late = g.rows().filter(r => r.state === 'late').map(r => r.key);
    expect(late).toEqual(['s3', 't11']);
  });

  it('hides tasks of a collapsed stage, and collapses or opens all of them', () => {
    const g = setup(stages, tasks);
    g.toggle(3);
    expect(g.rows().filter(r => r.kind === 'task').length).toBe(1);
    g.toggleAll();
    expect(g.rows().some(r => r.kind === 'task')).toBe(false);
    expect(g.allCollapsed()).toBe(true);
    g.toggleAll();
    expect(g.rows().filter(r => r.kind === 'task').length).toBe(3);
  });

  it('late-only keeps late stages and only their late tasks, and drops milestones', () => {
    const g = setup(stages, tasks);
    g.lateOnly.set(true);
    expect(g.rows().map(r => r.key)).toEqual(['s3', 't11']);
    g.clearFilters();
    expect(g.rows().length).toBe(6);
  });

  it('filters by the responsible department with its tasks', () => {
    const g = setup(stages, tasks);
    expect(g.depts()).toEqual(['قسم أ', 'قسم ب']);
    g.dept.set('قسم أ');
    expect(g.rows().map(r => r.key)).toEqual(['s2', 't10']);
    expect(g.filtersActive()).toBe(true);
  });

  it('widens the axis by zoom level (quarter < month < week)', () => {
    const g = setup(stages, tasks);
    const widths = (['quarter', 'month', 'week'] as const).map(z => { g.zoom.set(z); return g.W(); });
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
  });

  it('fits the whole axis inside the print width', () => {
    const g = setup(stages, tasks, { printMode: true, fit: 600 });
    expect(g.W()).toBeLessThanOrEqual(600);
    expect(g.labelW()).toBe(190);
  });

  it('splits a trailing Latin tail so truncation never cuts inside it', () => {
    const g = setup(stages);
    expect(g.parts('التصميم المعماري الأولي (Concept)')).toEqual({ head: 'التصميم المعماري الأولي', tail: '(Concept)' });
    expect(g.parts('تصميم الكهروميكانيك (MEP)')).toEqual({ head: 'تصميم الكهروميكانيك', tail: '(MEP)' });
    expect(g.parts('النمذجة BIM وكشف التعارضات')).toEqual({ head: 'النمذجة BIM وكشف التعارضات', tail: '' });
    expect(g.parts('الرفع الطبوغرافي')).toEqual({ head: 'الرفع الطبوغرافي', tail: '' });
  });

  it('puts the progress inside the bar only when the bar is wide enough', () => {
    const wide = setup([stage(2, { plannedStartDate: day(-20), plannedEndDate: day(10), progress: 60 })]);
    expect(wide.placed()[0].pct?.text).toBe('60%');
    const narrow = setup([stage(2, { plannedStartDate: day(0), plannedEndDate: day(1), progress: 60 })]);
    expect(narrow.placed()[0].pct).toBeNull();
  });
});
