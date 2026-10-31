import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { StudyPage } from './study-page';

const deliverable = (patch = {}) => ({
  approvedVersionId: null, approvedVersionNumber: null, assigneeName: 'مهندس', assigneeUserId: 5, blockedByName: null, canAttachDocument: false, canEdit: false,
  canPrepare: false, canRemove: false, canReview: false, canSendBack: false, canSubmit: false, documentId: null, dueDate: null, id: 1, isOverdue: false,
  latestVersionId: null, latestVersionNumber: null, note: '', officeId: null, officeName: null, returnNote: null, reviewedAt: null, reviewedByName: null,
  rowVersion: 'AAAA', sortOrder: 1, state: 1, stateAr: 'قيد الإعداد', submittedAt: null, submittedByName: null, submittedVersionId: null,
  submittedVersionNumber: null, typeId: 1, typeName: 'معماري', ...patch
});

const study = (patch = {}) => ({
  approvedPercent: 0, branchId: 1, canAddDeliverable: false, canCancel: false, canDecide: false, canEdit: false, canReopen: false, canSend: false,
  correspondenceId: null, correspondenceNumber: null, createdAt: '2026-10-28T08:00:00Z', createdByName: 'رئيس', deliverables: [deliverable()],
  deliverablesApproved: 0, deliverablesTotal: 1, dueDate: null, externalNumber: null, id: 7, isOverdue: false, mode: 1, modeAr: 'بالتسلسل', notes: '',
  number: 'STD-2026-00007', projectId: 3, projectName: 'مشروع المدرسة', rowVersion: 'ZZZZ', status: 1, statusAr: 'قيد الإعداد', submissions: [], title: 'دراسة المدرسة', ...patch
});

describe('Study page', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewStudies'], fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });
  afterEach(() => http.verify());

  const open = (data: object) => {
    const fixture = TestBed.createComponent(StudyPage);
    fixture.detectChanges();
    fixture.componentInstance.load(7);
    http.expectOne('/api/Studies/Get/7').flush(data);
    fixture.detectChanges();
    return fixture;
  };
  const text = (f: { nativeElement: unknown }) => (f.nativeElement as HTMLElement).textContent ?? '';

  it('shows only the actions the server allows on each deliverable and on the study', () => {
    const fixture = open(study({
      canSend: false,
      deliverables: [
        deliverable({ id: 1, typeName: 'معماري', canPrepare: true, canSubmit: true, documentId: 5, latestVersionNumber: 2 }),
        deliverable({ id: 2, typeName: 'إنشائي', canReview: true, state: 2, stateAr: 'بانتظار المراجعة', submittedVersionNumber: 1 }),
        deliverable({ id: 3, typeName: 'كهربائي', state: 3, stateAr: 'معتمد', canSendBack: true, approvedVersionNumber: 1 })
      ], deliverablesTotal: 3
    }));
    const t = text(fixture);
    expect(t).toContain('رفع إصدار جديد');         // معماري: لديه ملف
    expect(t).toContain('رفع للمراجعة');
    expect(t).toContain('اعتماد / إعادة');          // إنشائي
    expect(t).toContain('إعادة لجولة جديدة');       // كهربائي المعتمد
    expect(t).not.toContain('إرسال إلى المركزية');
    expect(t).not.toContain('تعديل');
    expect(t).not.toContain('+ مخرج');
  });

  it('explains why a deliverable waits in a sequential order and shows the center notes after a return', () => {
    const fixture = open(study({
      status: 4, statusAr: 'أعادتها المركزية بملاحظات', canReopen: true,
      submissions: [{ id: 3, round: 1, sentAt: '2026-10-29T08:00:00Z', sentByName: 'رئيس', note: '', decision: 3, decisionAr: 'أعادتها بملاحظات', decidedAt: null, decidedByName: 'رئيس', decisionNote: 'راجعوا الكميات', decisionVersionId: null, outgoingCorrespondenceId: null, outgoingCorrespondenceNumber: null, rowVersion: 'B' }],
      deliverables: [deliverable({ blockedByName: 'معماري' })]
    }));
    const t = text(fixture);
    expect(t).toContain('ينتظر اعتماد «معماري»');
    expect(t).toContain('راجعوا الكميات');
    expect(t).toContain('فتح جولة جديدة');
  });

  it('refuses to return a deliverable without a reason and posts the approval with the row version it saw', () => {
    const fixture = open(study({ deliverables: [deliverable({ canReview: true, state: 2, submittedVersionNumber: 2, rowVersion: 'RV1' })] }));
    const page = fixture.componentInstance;
    const d = page.study()!.deliverables[0];
    page.open({ kind: 'review', d });

    page.review(false);
    http.expectNone('/api/Studies/Deliverable/1/Review');
    expect(page.formError()).toBe('اكتب سبب إعادة المخرج');

    page.review(true);
    const req = http.expectOne('/api/Studies/Deliverable/1/Review');
    expect(req.request.body).toEqual({ approve: true, note: null, rowVersion: 'RV1' });
    req.flush(study({ deliverables: [deliverable({ state: 3, stateAr: 'معتمد' })], deliverablesApproved: 1, approvedPercent: 100 }));
    expect(page.dialog()).toBeNull();
    expect(page.study()!.deliverablesApproved).toBe(1);
  });

  it('asks for the center notes before recording a returned decision', () => {
    const round = { id: 3, round: 1, sentAt: '2026-10-29T08:00:00Z', sentByName: 'رئيس', note: '', decision: 1, decisionAr: 'بانتظار القرار', decidedAt: null, decidedByName: null, decisionNote: '', decisionVersionId: null, outgoingCorrespondenceId: null, outgoingCorrespondenceNumber: null, rowVersion: 'R' };
    const fixture = open(study({ status: 2, canDecide: true, submissions: [round] }));
    const page = fixture.componentInstance;
    page.open({ kind: 'decide', s: page.study()!.submissions[0] });

    page.decision = 3;
    page.decide();
    http.expectNone('/api/Studies/Decide/3');
    expect(page.formError()).toBe('اكتب ملاحظات المركزية');

    page.note = 'راجعوا الكميات';
    page.decide();
    expect(http.expectOne('/api/Studies/Decide/3').request.body).toEqual({ decision: 3, note: 'راجعوا الكميات', decisionVersionId: null, rowVersion: 'R' });
  });
});
