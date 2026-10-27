import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ScheduleDependency, ScheduleTask } from '../data-access/schedule.models';
import { ScheduleDependenciesDialog, ScheduleProgressDialog } from './schedule-dialogs';
import { ScheduleGantt } from './schedule-gantt';
import { ScheduleDecisionDialog } from './schedule-shared';

const task = (id: number, extra: Partial<ScheduleTask> = {}): ScheduleTask => ({
  id, sortOrder: id, code: '', name: 'بند ' + id, plannedStart: '2026-11-01T00:00:00', plannedEnd: '2026-11-10T00:00:00', originalStart: null, originalEnd: null,
  extraDays: 0, weight: 1, isCritical: false, status: 2, statusName: 'قيد التنفيذ', progress: 50, actualStart: null, actualEnd: null, note: '',
  assigneeUserId: null, assigneeName: null, isOverdueCandidate: false, datesLocked: false, rowVersion: 'v', ...extra
});

describe('schedule components', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('Gantt draws a bar per task and emits the picked task', async () => {
    const f = TestBed.createComponent(ScheduleGantt);
    const picked: number[] = [];
    f.componentInstance.taskSelect.subscribe(id => picked.push(id));
    f.componentRef.setInput('tasks', [task(1, { isCritical: true }), task(2, { isOverdueCandidate: true, originalStart: '2026-11-01', originalEnd: '2026-11-05' })]);
    f.componentRef.setInput('dependencies', [{ id: 1, predecessorId: 1, successorId: 2, hasConflict: false } satisfies ScheduleDependency]);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('g.bar-group')).toHaveLength(2);
    expect(el.querySelectorAll('rect.fill.critical')).toHaveLength(1);
    expect(el.querySelectorAll('rect.track.overdue')).toHaveLength(1);
    expect(el.querySelectorAll('rect.base')).toHaveLength(1);        // التاريخ الحالي ابتعد عن الأصلي
    expect(el.querySelectorAll('path.arrow')).toHaveLength(1);
    (el.querySelectorAll('g.bar-group')[1] as SVGElement).dispatchEvent(new Event('click'));
    expect(picked).toEqual([2]);
  });

  it('Gantt says so when the schedule has no tasks', async () => {
    const f = TestBed.createComponent(ScheduleGantt);
    f.componentRef.setInput('tasks', []);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('لا بنود');
    expect(f.nativeElement.querySelector('svg')).toBeNull();
  });

  it('progress dialog keeps the status and the percentage consistent', async () => {
    const f = TestBed.createComponent(ScheduleProgressDialog);
    f.componentRef.setInput('task', task(1, { progress: 60 }));
    await f.whenStable();
    TestBed.inject(HttpTestingController).match(() => true).forEach(r => r.flush([]));
    const c = f.componentInstance;

    c.statusChanged(3);                                            // مكتمل ← 100%
    expect(c.form.controls.progress.value).toBe(100);
    c.statusChanged(1);                                            // لم يبدأ ← 0%
    expect(c.form.controls.progress.value).toBe(0);
    c.form.controls.progress.setValue(100);
    c.progressChanged();                                           // 100% ← مكتمل
    expect(c.form.controls.status.value).toBe(3);
    c.form.controls.progress.setValue(30);
    c.progressChanged();                                           // نزل من 100 والحالة مكتمل ← قيد التنفيذ
    expect(c.form.controls.status.value).toBe(2);
  });

  it('progress dialog refuses lowering the percentage without a note', async () => {
    const f = TestBed.createComponent(ScheduleProgressDialog);
    f.componentRef.setInput('task', task(1, { progress: 60 }));
    await f.whenStable();
    TestBed.inject(HttpTestingController).match(() => true).forEach(r => r.flush([]));
    const c = f.componentInstance;
    const sent: unknown[] = [];
    c.submitted.subscribe(v => sent.push(v));

    c.form.controls.progress.setValue(40);
    c.save();
    expect(sent).toHaveLength(0);
    expect(c.problem()).toContain('ملاحظة');

    c.form.controls.note.setValue('إعادة قياس');
    c.save();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ progress: 40, note: 'إعادة قياس', rowVersion: 'v' });
  });

  it('dependency dialog adds only a pair of different tasks', async () => {
    const f = TestBed.createComponent(ScheduleDependenciesDialog);
    f.componentRef.setInput('tasks', [task(1), task(2)]);
    f.componentRef.setInput('dependencies', [{ id: 5, predecessorId: 1, successorId: 2, hasConflict: true }]);
    await f.whenStable();
    expect(document.body.textContent).toContain('تعارض زمني');
    const added: unknown[] = [];
    f.componentInstance.added.subscribe(v => added.push(v));
    f.componentInstance.predecessor.set(1);
    f.componentInstance.successor.set(2);
    f.componentInstance.add();
    expect(added).toEqual([{ predecessorId: 1, successorId: 2 }]);
    expect(f.componentInstance.predecessor()).toBe(0);
  });

  it('decision dialog demands a reason for a rejection only', async () => {
    const f = TestBed.createComponent(ScheduleDecisionDialog);
    f.componentRef.setInput('heading', 'قرار');
    await f.whenStable();
    const c = f.componentInstance;
    const sent: { approve: boolean; note: string }[] = [];
    c.submitted.subscribe(v => sent.push(v));

    c.save();                                                      // اعتماد بلا ملاحظة مقبول
    c.approve.set(false);
    c.save();                                                      // رفض بلا سبب مرفوض
    expect(c.problem()).toContain('سبب');
    c.note = 'ناقص';
    c.save();
    expect(sent).toEqual([{ approve: true, note: '' }, { approve: false, note: 'ناقص' }]);
  });
});
