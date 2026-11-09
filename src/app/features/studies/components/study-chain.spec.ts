import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StudyChain } from '../data-access/studies.models';
import { StudyChainView } from './study-chain';

const chain = (over: Partial<StudyChain> = {}): StudyChain => ({
  requestId: 1, requestNumber: 'REQ-26-0001', requestStatus: 3,
  assignmentId: 2, assignmentNumber: 'IPA-26-0001', assignmentStatus: 2,
  responseId: null, responseStatus: null, startOrderId: null, startOrderNumber: null, startOrderStatus: null,
  projectId: null, projectCode: null, projectStatus: null, ...over
});

function open(c: StudyChain, current: 'requests' | 'assignments' | 'project' | null = 'assignments') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StudyChainView);
  fixture.componentRef.setInput('chain', c);
  fixture.componentRef.setInput('current', current);
  fixture.detectChanges();
  return { fixture, view: fixture.componentInstance, steps: Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li')) };
}

describe('StudyChainView', () => {
  it('shapes each step by its state: done, waiting, missing', () => {
    const { view, steps } = open(chain());
    expect(view.steps().map(s => view.tone(s))).toEqual(['done', 'wait', 'missing', 'missing', 'missing']);
    expect(steps.map(li => li.className.includes('done') ? 'done' : li.className.includes('wait') ? 'wait' : 'missing'))
      .toEqual(['done', 'wait', 'missing', 'missing', 'missing']);
    expect(steps[2].textContent).toContain('لم يصدر بعد');
  });

  it('fills the line only after a finished step that has a next one, and marks the current step', () => {
    const { view, steps } = open(chain());
    expect([0, 1, 2, 3].map(i => view.filled(i))).toEqual([true, false, false, false]);
    expect([0, 1, 2, 3].map(i => view.linked(i))).toEqual([true, false, false, false]);
    expect(steps[1].classList.contains('current')).toBe(true);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[0].getAttribute('aria-current')).toBeNull();
  });

  it('links other steps but not the current one, and maps project statuses', () => {
    const done = chain({ responseId: 3, responseStatus: 3, startOrderId: 4, startOrderNumber: 'PIO-26-0001', startOrderStatus: 3,
      projectId: 5, projectCode: 'ST-26-001', projectStatus: 3 });
    const { view, steps } = open(done, 'project');
    expect(view.steps().map(s => view.tone(s))).toEqual(['done', 'wait', 'done', 'done', 'done']);
    expect(steps[0].querySelector('a')?.getAttribute('href')).toBe('/studies/requests/1');
    expect(steps[4].querySelector('a')).toBeNull();
    expect(steps[4].textContent).toContain('مكتمل');
    expect(open(chain({ projectId: 5, projectCode: 'ST-26-001', projectStatus: 4 })).view.tone({ number: 'x', status: 5 } as never)).toBe('off');
  });
});
