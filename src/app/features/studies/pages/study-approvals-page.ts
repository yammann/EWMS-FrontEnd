import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { StudyDecisionDialog } from '../components/decision-dialog';
import { StudyApprovalsService } from '../data-access/study-approvals.service';
import { StudyApprovalQueueItem } from '../data-access/studies.models';
import { ownerLink } from '../utils/document-meta';

/**
 * «بانتظار توقيعي»: سطور التواقيع التي يستطيع المستخدم التوقيع عليها الآن (صفته وحدّها ودوره في الترتيب).
 * يُفتح المستند للمراجعة قبل القرار؛ وما لم تُبنَ صفحته بعد (المشروع وCDA) يُقرَّر من هنا مباشرة.
 */
@Component({
  selector: 'app-study-approvals-page',
  standalone: true,
  imports: [RouterLink, PageHeader, Alert, EmptyState, StudyDecisionDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/list-tools.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="فرع الدراسات" heading="بانتظار توقيعي" subtitle="المستندات التي حان دورك في توقيعها">
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) {
          <div class="empty-state"><h3>لا شيء بانتظار توقيعك</h3><p>يصلك إشعار حين يحين دورك في توقيع مستند.</p></div>
        } @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>المستند</th><th>البيان</th><th>صفة التوقيع</th><th>الترتيب</th><th>الفرع</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (a of items(); track a.approvalId) {
                <tr>
                  <td><span class="cell-strong">{{ a.ownerTypeName }}</span><small class="mono">{{ a.ownerNumber }}</small></td>
                  <td>{{ a.ownerTitle }}</td>
                  <td>{{ a.signerRoleName }}</td>
                  <td class="mono">{{ a.sortOrder }}</td>
                  <td>{{ a.branchName }}</td>
                  <td class="row-buttons">
                    @if (link(a); as l) { <a class="btn btn-sm" [routerLink]="l">فتح للمراجعة</a> }
                    @else { <button class="btn btn-sm" type="button" (click)="deciding.set(a)">قرار</button> }
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </section>
    </div>

    @if (deciding(); as a) {
      <app-study-decision-dialog [approval]="{ id: a.approvalId, signerRoleName: a.signerRoleName }" [documentLabel]="a.ownerNumber"
                                 (closed)="deciding.set(null)" (decided)="decided()" />
    }
  `,
  styles: [`
    td small { display: block; color: var(--ink-500); font-size: 12px; }
    .row-buttons { text-align: end; white-space: nowrap; }
  `]
})
export class StudyApprovalsPage {
  private service = inject(StudyApprovalsService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  items = signal<StudyApprovalQueueItem[]>([]);
  loading = signal(false);
  error = signal('');
  deciding = signal<StudyApprovalQueueItem | null>(null);

  constructor() { this.load(); }

  load() { this.latest(this.service.pending(), this.loading, this.error, list => this.items.set(list)); }

  link(a: StudyApprovalQueueItem) { return ownerLink(a.ownerType, a.ownerId); }

  decided() {
    this.deciding.set(null);
    this.toast.success('حُفظ القرار');
    this.load();
  }
}
