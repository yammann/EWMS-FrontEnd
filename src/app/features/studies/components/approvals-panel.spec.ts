import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services/auth.service';
import { StudyApproval, StudyDecision } from '../data-access/studies.models';
import { StudyApprovalsPanel } from './approvals-panel';

const row = (id: number, signerRole: number, decision: StudyApproval['decision'], canDecide = false): StudyApproval => ({
  id, signerRole, signerRoleName: 'رئيس القسم المختص', sortOrder: id, decision, decisionName: '', signerUserId: null, signerName: null,
  jobTitle: null, hasSignature: false, decidedAt: null, note: null, canDecide
});

function setup(approvals: StudyApproval[], allowed = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { hasPermission: () => allowed } }] });
  const fixture = TestBed.createComponent(StudyApprovalsPanel);
  fixture.componentRef.setInput('approvals', approvals);
  fixture.detectChanges();
  return fixture;
}

describe('StudyApprovalsPanel', () => {
  it('explains which permission the next pending signer needs, only on that row', () => {
    const f = setup([row(1, 3, StudyDecision.Pending), row(2, 4, StudyDecision.Pending)]);
    const why = (f.nativeElement as HTMLElement).querySelectorAll('.why');
    expect(why.length).toBe(1);
    expect(why[0].textContent).toContain('توقيع بصفة رئيس القسم المختص');
    expect(why[0].textContent).toContain('قسم المستند');
  });

  it('says the document is outside the boundary when the user holds the permission', () => {
    const f = setup([row(1, 3, StudyDecision.Pending)], true);
    expect(f.nativeElement.querySelector('.why').textContent).toContain('صفتك تسمح');
  });

  it('shows no hint when the user can sign, after a rejection, or when nothing is pending', () => {
    expect(setup([row(1, 3, StudyDecision.Pending, true)]).nativeElement.querySelector('.why')).toBeNull();
    expect(setup([row(1, 3, StudyDecision.Rejected), row(2, 4, StudyDecision.Pending)]).nativeElement.querySelector('.why')).toBeNull();
    expect(setup([row(1, 3, StudyDecision.Approved)]).nativeElement.querySelector('.why')).toBeNull();
  });
});
