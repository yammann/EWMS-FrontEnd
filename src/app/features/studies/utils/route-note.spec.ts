import { StudyApproval, StudyChain, StudyPerson } from '../data-access/studies.models';
import { peopleText, routeNote } from './route-note';
const person = (fullName: string, departmentName: string | null = null): StudyPerson => ({ id: 1, fullName, departmentName, jobTitle: null });

const row = (sortOrder: number, decision: number, signerRoleName: string): StudyApproval => ({
  id: sortOrder, signerRole: sortOrder, signerRoleName, sortOrder, decision: decision as StudyApproval['decision'], decisionName: '',
  signerUserId: null, signerName: null, jobTitle: null, hasSignature: false, decidedAt: null, note: null, canDecide: false
});
const chain = (over: Partial<StudyChain> = {}): StudyChain => ({
  requestId: 1, requestNumber: 'REQ-26-0001', requestStatus: 3, assignmentId: null, assignmentNumber: null, assignmentStatus: null,
  responseId: null, responseStatus: null, startOrderId: null, startOrderNumber: null, startOrderStatus: null,
  projectId: null, projectCode: null, projectStatus: null, ...over
});

describe('routeNote', () => {
  it('explains what registering a draft request does', () => {
    const n = routeNote('requests', { status: 1, approvals: [], chain: null })!;
    expect(n.title).toContain('لم تُسجَّل');
    expect(n.text).toContain('التكليف الداخلي');
  });

  it('lists the signers of a draft that needs signatures', () => {
    expect(routeNote('startOrders', { status: 1, approvals: [], chain: null })!.text).toContain('رئيس القسم المختص ثم رئيس الفرع');
    expect(routeNote('responses', { status: 1, approvals: [], chain: null })!.text).toContain('القسم المتابع ثم التخطيط وإدارة المشاريع');
  });

  it('names the next pending signer and the progress', () => {
    const n = routeNote('startOrders', { status: 2, chain: null, approvals: [row(2, 1, 'رئيس الفرع'), row(1, 2, 'رئيس القسم المختص')] })!;
    expect(n.tone).toBe('wait');
    expect(n.title).toBe('بانتظار توقيع «رئيس الفرع»');
    expect(n.text).toContain('اكتمل 1 من 2');
  });

  it('says a registered request waits for its assignment, and who issues it', () => {
    const n = routeNote('requests', { status: 3, approvals: [], chain: chain() })!;
    expect(n.tone).toBe('wait');
    expect(n.title).toContain('التكليف الداخلي');
    expect(n.text).toContain('إصدار تكليف داخلي');
    expect(n.link).toBeUndefined();
  });

  it('links to the next document once it is issued', () => {
    const n = routeNote('requests', { status: 3, approvals: [], chain: chain({ assignmentId: 5, assignmentNumber: 'IPA-26-0003' }) })!;
    expect(n.tone).toBe('done');
    expect(n.link).toBe('/studies/assignments/5');
    expect(n.linkLabel).toBe('IPA-26-0003');
  });

  it('names the following department as the one who writes the response', () => {
    const n = routeNote('assignments', { status: 3, approvals: [], chain: chain(), followingDepartmentName: 'قسم إدارة التصميم' })!;
    expect(n.text).toContain('قسم إدارة التصميم');
  });

  it('ends the study at an "unavailable" response, and shows nothing for rejected or cancelled documents', () => {
    expect(routeNote('responses', { status: 3, approvals: [], chain: chain(), recommendation: 3 })!.title).toContain('غير متاح');
    expect(routeNote('responses', { status: 4, approvals: [], chain: chain() })).toBeNull();
    expect(routeNote('responses', { status: 5, approvals: [], chain: chain() })).toBeNull();
  });

  it('names who signs now, and warns when nobody holds the permission', () => {
    const pending = { status: 2, chain: null, approvals: [row(1, 1, 'رئيس الفرع')] };
    const named = routeNote('assignments', { ...pending, nextSigners: [person('لينا عباس', 'قسم إدارة التصميم')], nextSignersTotal: 1 })!;
    expect(named.text).toContain('يوقّعه: لينا عباس (قسم إدارة التصميم).');
    const none = routeNote('assignments', { ...pending, nextSigners: [], nextSignersTotal: 0 })!;
    expect(none.text).toContain('لا موظف يملك صلاحية «توقيع بصفة رئيس الفرع»');
    expect(routeNote('assignments', pending)!.text).not.toContain('يوقّعه');
  });

  it('names who issues the next document, and warns when nobody can', () => {
    const base = { status: 3, approvals: [], chain: chain() };
    const named = routeNote('requests', { ...base, nextIssuers: [person('بشار ديب'), person('جمال درويش', 'قسم المشاريع')], nextIssuersTotal: 10 })!;
    expect(named.text).toContain('يُصدره: بشار ديب، جمال درويش (قسم المشاريع) و8 آخرين.');
    expect(routeNote('requests', { ...base, nextIssuers: [], nextIssuersTotal: 0 })!.text).toContain('لا موظف في الفرع يملك صلاحية إصدار «التكليف الداخلي»');
    expect(routeNote('requests', base)!.text).toContain('إصدار تكليف داخلي');
  });

  it('formats a short list of people without a remainder', () => {
    expect(peopleText([person('أحمد')])).toBe('أحمد');
  });
});
