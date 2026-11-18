import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { StudyAssignmentFormDialog } from './assignment-form-dialog';

function open(adminArchiveNumber: string | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(StudyAssignmentFormDialog);
  fixture.componentRef.setInput('parent', { requestId: 3, requestNumber: '001', mainBeneficiary: 'الجهة', branchId: 7, adminArchiveNumber });
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/Department/GetAll').flush([{ id: 2, name: 'القسم', branchId: 7 }]);
  return { fixture, component: fixture.componentInstance, http };
}

describe('StudyAssignmentFormDialog project code', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows the latest server code read-only and saves without a client-supplied code', () => {
    const { fixture, component, http } = open('009');
    component.form.patchValue({
      assignmentDate: '2025-12-31', followingDepartmentId: 2, scopeSummary: 'نطاق العمل',
      referralDate: '2025-12-31', responseDeadline: '2026-01-10'
    });
    vi.advanceTimersByTime(200);
    const previous = http.expectOne('/api/StudyAssignments/ProjectCode/3?assignmentDate=2025-12-31');
    component.form.controls.assignmentDate.setValue('2026-01-01');
    expect(previous.cancelled).toBe(true);
    component.save();
    http.expectNone('/api/StudyAssignments/Create');
    vi.advanceTimersByTime(200);
    http.expectOne('/api/StudyAssignments/ProjectCode/3?assignmentDate=2026-01-01')
      .flush({ projectCode: '7-26-N-001-009' });
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[readonly]');
    expect(input?.value).toBe('7-26-N-001-009');
    component.save();
    const create = http.expectOne('/api/StudyAssignments/Create');
    expect(create.request.body).not.toHaveProperty('projectCode');
    expect(create.request.body).not.toHaveProperty('adminArchiveNumber');
    create.flush({ id: 1 });
  });

  it('waits for an archive number when the request has none', () => {
    const { component, http } = open(null);
    component.form.controls.assignmentDate.setValue('2026-11-18');
    vi.advanceTimersByTime(200);
    http.expectNone(req => req.url.includes('/StudyAssignments/ProjectCode/'));
    component.form.controls.adminArchiveNumber.setValue(' 0009/26 ');
    vi.advanceTimersByTime(200);
    http.expectOne('/api/StudyAssignments/ProjectCode/3?assignmentDate=2026-11-18&adminArchiveNumber=0009%2F26')
      .flush({ projectCode: '7-26-RN-001-0009/26' });
    expect(component.projectCode()).toBe('7-26-RN-001-0009/26');
  });
});
