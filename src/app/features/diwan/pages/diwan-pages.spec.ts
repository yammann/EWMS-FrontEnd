import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { DiwanPage } from './diwan-page';
import { CorrespondencePage } from './correspondence-page';

const item = (patch = {}) => ({
  id: 5, number: 'IN-2026-00005', direction: 1, directionAr: 'وارد', branchId: 1, subject: 'أمر دراسة المدرسة', party: 'المركزية', externalNumber: 'م/55',
  typeId: 1, typeName: 'أمر دراسة', statusId: 2, statusName: 'قيد المعالجة', statusColor: '#34C759', stage: 2, outgoingState: null, outgoingStateAr: null, isSubmitted: false,
  projectId: null, projectName: null, currentUnitName: 'قسم الدراسات', dueDate: '2026-11-10T00:00:00', isOverdue: true, isClosed: false,
  registeredAt: '2026-11-01T08:00:00Z', registeredByName: 'كاتب', ...patch
});

describe('Diwan pages', () => {
  let http: HttpTestingController;

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const flushLookups = () => {
    http.expectOne(r => r.url.startsWith('/api/CorrespondenceTypes/GetAll')).flush([]);
    http.expectOne(r => r.url.startsWith('/api/CorrespondenceStatuses/GetAll')).flush([]);
  };

  it('opens on the inbox for a handler, lists the items and marks the late one', () => {
    login(['HandleCorrespondence', 'RegisterCorrespondence']);
    const fixture = TestBed.createComponent(DiwanPage);
    fixture.detectChanges();

    const req = http.expectOne(r => r.url.startsWith('/api/Correspondence/Search'));
    expect(new URLSearchParams(req.request.url.split('?')[1]).get('inbox')).toBe('true');
    req.flush({ items: [item()], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 });
    flushLookups();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('IN-2026-00005');
    expect(text).toContain('أمر دراسة المدرسة');
    expect(text).toContain('متأخرة');
    expect(text).toContain('+ تسجيل وارد');
    expect(text).toContain('صندوقي');
  });

  it('hides the register buttons and the inbox from someone who only views', () => {
    login(['ViewCorrespondence']);
    const fixture = TestBed.createComponent(DiwanPage);
    fixture.detectChanges();
    http.expectOne(r => r.url.startsWith('/api/Correspondence/Search')).flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
    flushLookups();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('+ تسجيل وارد');
    expect(text).not.toContain('صندوقي');
    expect(text).toContain('لا توجد معاملات ضمن صلاحياتك');
  });

  it('shows only the actions the server allows on the item', () => {
    login(['ViewCorrespondence']);
    const fixture = TestBed.createComponent(CorrespondencePage);
    fixture.detectChanges();
    // لا معرّف في المسار: لا طلب. نحمّل يدوياً.
    fixture.componentInstance.load(5);
    http.expectOne('/api/Correspondence/Get/5').flush({
      ...item(), summary: 'ملخص', externalDate: null, replyToId: null, replyToNumber: null, currentDepartmentId: 3, currentOfficeId: null, currentUserId: null,
      currentUserName: null, returnNote: null, approvedByName: null, approvedAt: null, issuedAt: null, issuedByName: null, closedAt: null,
      referrals: [], attachments: [], canEdit: false, canRefer: true, canAcknowledge: false, canChangeStatus: false, canClose: false, canAttach: false,
      canSubmit: false, canApprove: false, canIssue: false, rowVersion: 'AAAA'
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('إحالة');
    expect(text).not.toContain('تعديل');
    expect(text).not.toContain('تأكيد الاستلام');
    expect(text).not.toContain('إصدار برقم');
    expect(text).toContain('تجاوزت مهلتها');
  });
  const detail = (patch = {}) => ({
    ...item(), summary: 'ملخص', externalDate: null, replyToId: null, replyToNumber: null, currentDepartmentId: 3, currentOfficeId: null, currentUserId: null,
    currentUserName: null, returnNote: null, submittedAt: null, approvedByName: null, approvedAt: null, issuedAt: null, issuedByName: null, closedAt: null,
    referrals: [], attachments: [], canEdit: false, canRefer: false, canAcknowledge: false, canChangeStatus: true, canClose: false, canAttach: false,
    canSubmit: false, canApprove: false, canIssue: false, rowVersion: 'AAAA', ...patch
  });
  const statuses = [1, 2, 3, 4].map(stage => ({ id: stage, name: 'حالة ' + stage, stage, stageAr: '', color: '#000000', sortOrder: stage, isActive: true }));

  it('shows the submitted-for-approval notice and hides the submit button', () => {
    login(['ViewCorrespondence']);
    const fixture = TestBed.createComponent(CorrespondencePage);
    fixture.detectChanges();
    fixture.componentInstance.load(5);
    http.expectOne('/api/Correspondence/Get/5').flush(detail({
      direction: 2, directionAr: 'صادر', number: null, outgoingState: 1, outgoingStateAr: 'بانتظار الاعتماد', statusId: null, statusName: null, stage: null,
      isSubmitted: true, submittedAt: '2026-10-28T10:00:00Z', canSubmit: false, canChangeStatus: false
    }));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('بانتظار الاعتماد');
    expect(text).toContain('بانتظار قرار المعتمِد');
    expect(text).not.toContain('رفع للاعتماد');
  });

  it('offers the closed stage only to someone who may close', () => {
    login(['ViewCorrespondence']);
    const fixture = TestBed.createComponent(CorrespondencePage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.statuses.set(statuses as never);
    page.item.set(detail({ canClose: false }) as never);
    expect(page.statusOptions().map(s => s.stage)).toEqual([1, 2, 3]);
    page.item.set(detail({ canClose: true }) as never);
    expect(page.statusOptions().map(s => s.stage)).toEqual([1, 2, 3, 4]);
    page.item.set(detail({ isClosed: true, canClose: false }) as never);   // إعادة الفتح
    expect(page.statusOptions()).toHaveLength(4);
  });
});
