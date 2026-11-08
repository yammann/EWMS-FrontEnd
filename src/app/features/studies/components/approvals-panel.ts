import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AppPermission, AppPermissionName } from '@core/constants/access';
import { AuthService } from '@core/services/auth.service';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon';
import { StudyApproval, StudyDecision } from '../data-access/studies.models';
import { StudyDecisionDialog } from './decision-dialog';
import { StudyStatusChip } from './study-status-chip';

/**
 * تواقيع المستند بالترتيب: صفة الموقّع، القرار، من وقّع ومسمّاه ووقته، الملاحظة، وهل حُفظ توقيعه.
 * زر «توقيع» يظهر للسطر الذي يستطيع المستخدم التوقيع عليه الآن (canDecide من الخادم).
 */
@Component({
  selector: 'app-study-approvals-panel',
  standalone: true,
  imports: [DatePipe, UtcPipe, Icon, StudyStatusChip, StudyDecisionDialog],
  template: `
    <section class="panel">
      <div class="panel-heading"><div>
        <h2>التواقيع</h2>
        <p>تُوقَّع بالترتيب؛ أي رفض يرفض المستند ويعيده لصاحبه ليعدّله ويرسله من جديد.</p>
      </div></div>
      @if (!approvals().length) {
        <p class="muted empty">{{ emptyText() }}</p>
      } @else {
        <ol class="signers">
          @for (a of approvals(); track a.id) {
            <li [class.next]="a.canDecide">
              <span class="order" aria-hidden="true">{{ a.sortOrder }}</span>
              <div class="who">
                <strong>{{ a.signerRoleName }}</strong>
                @if (a.signerName) {
                  <span>{{ a.signerName }}@if (a.jobTitle) { <small> · {{ a.jobTitle }}</small> }</span>
                  <small class="muted">{{ a.decidedAt | utc | date:'yyyy/MM/dd — HH:mm' }}
                    · @if (a.hasSignature) { <app-icon name="pencil" [size]="12" /> بتوقيعه } @else { بلا توقيع محفوظ }</small>
                }
                @if (a.note) { <p class="note">{{ a.note }}</p> }
                @if (a.id === nextId() && !a.canDecide) { <small class="why">{{ whyNot(a) }}</small> }
              </div>
              <div class="state">
                <app-study-status-chip kind="decision" [status]="a.decision" [name]="a.decisionName" />
                @if (a.canDecide) { <button class="btn btn-sm" type="button" (click)="deciding.set(a)">توقيع</button> }
              </div>
            </li>
          }
        </ol>
      }
    </section>

    @if (deciding(); as a) {
      <app-study-decision-dialog [approval]="a" [documentLabel]="documentLabel()" (closed)="deciding.set(null)"
                                 (decided)="deciding.set(null); decided.emit($event)" />
    }
  `,
  styles: [`
    .empty { margin: 0; }
    .signers { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 12px;
         border-radius: 12px; background: var(--fill); }
    li.next { background: var(--brand-50); box-shadow: inset 0 0 0 1.5px var(--brand-300); }
    .order { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--material, #fff);
             font-weight: 700; color: var(--ink-600); }
    .who { display: grid; gap: 3px; min-width: 0; }
    .who small { color: var(--ink-500); }
    .who .why { color: var(--warning-700); line-height: 1.6; }
    .note { margin: 4px 0 0; white-space: pre-line; color: var(--ink-700); font-size: 14px; }
    .state { display: grid; gap: 8px; justify-items: end; }
    @media (max-width: 560px) { li { grid-template-columns: 32px minmax(0, 1fr); } .state { grid-column: 2; justify-items: start; } }
  `]
})
export class StudyApprovalsPanel {
  private auth = inject(AuthService);

  approvals = input.required<StudyApproval[]>();
  documentLabel = input('');
  emptyText = input('تُنشأ سطور التواقيع عند إرسال المستند للاعتماد.');
  decided = output<StudyApproval>();

  deciding = signal<StudyApproval | null>(null);

  /** السطر الذي جاء دوره: أول سطر معلّق بعد توقيعات إيجابية كلها (لا رفض ولا سطر سابق معلّق) */
  nextId = computed(() => {
    for (const a of [...this.approvals()].sort((x, y) => x.sortOrder - y.sortOrder)) {
      if (a.decision === StudyDecision.Pending) return a.id;
      if (a.decision === StudyDecision.Rejected) return null;
    }
    return null;
  });

  /** لماذا لا يظهر زر التوقيع للمستخدم الحالي على السطر الذي جاء دوره (فيعرف المسؤول ما الناقص) */
  whyNot(a: StudyApproval): string {
    const permission = SIGN_PERMISSION[a.signerRole];
    const mine = permission ? this.auth.hasPermission(permission) : false;
    if (mine) {
      return DEPARTMENT_ROLES.has(a.signerRole)
        ? 'بانتظار هذا التوقيع: صفتك تسمح به لكنه من حدّ قسم المستند، ولا يوقّعه إلا من يتبع ذلك القسم.'
        : 'بانتظار هذا التوقيع: صفتك تسمح به لكنه خارج حدّ فرعك، أو سبق أن وقّعت هذا المستند.';
    }
    return `بانتظار توقيع «${a.signerRoleName}»: يوقّعه من يحمل دوره صلاحية «توقيع بصفة ${a.signerRoleName}»`
      + (DEPARTMENT_ROLES.has(a.signerRole) ? ' ويتبع قسم المستند.' : '.')
      + ' إن لم يجد صاحب الصفة زر التوقيع فيُمنح الصلاحية من صفحة الأدوار.';
  }
}

/** صلاحية التوقيع لكل صفة موقّع (تطابق StudyRules.SignPermission في الخادم) */
const SIGN_PERMISSION: Record<number, AppPermissionName> = {
  1: AppPermission.SignStudyAsFollowingDepartment, 2: AppPermission.SignStudyAsPlanning,
  3: AppPermission.SignStudyAsCompetentDepartment, 4: AppPermission.SignStudyAsBranchHead,
  5: AppPermission.SignStudyAsSendingDepartment, 6: AppPermission.SignStudyAsDesignManagement,
  7: AppPermission.SignStudyAsQualityControl, 8: AppPermission.SignStudyAsProjectManagement
};
/** الصفات المحدودة بقسم المستند: المتابع والمختص والمرسل */
const DEPARTMENT_ROLES = new Set([1, 3, 5]);
