import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { DiwanPage } from './diwan-page';
import { CorrespondencePage } from './correspondence-page';

const item = (patch = {}) => ({
  id: 5, number: 'IN-2026-00005', direction: 1, directionAr: 'وارد', branchId: 1, subject: 'أمر دراسة المدرسة', party: 'المركزية', externalNumber: 'م/55',
  typeId: 1, typeName: 'أمر دراسة', statusId: 2, statusName: 'قيد المعالجة', statusColor: '#34C759', stage: 2, outgoingState: null, outgoingStateAr: null,
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
});
