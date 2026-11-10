import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { AuthService } from '@core/services/auth.service';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { StudyApprovalsPanel } from '../../components/approvals-panel';
import { StudyDesignApprovalFormDialog } from '../../components/design-approval-form-dialog';
import { StudyStatusChip } from '../../components/study-status-chip';
import { StudyDrawingsService } from '../../data-access/study-drawings.service';
import { DesignApproval } from '../../data-access/studies.models';

/**
 * اعتماد المخططات الأولي (CDA) لنسخة معمارية: بياناته وتواقيعه الثلاثة بالترتيب (القسم المرسل، إدارة التصميم، ضبط الجودة).
 * قرار المستند: بانتظار، أو معتمد، أو معتمد مع ملاحظات، أو مرفوض (يرفض النسخة والمخطط). يُعدَّل ويُحذف قبل أول توقيع فقط.
 * الطباعة بالنموذج الورقي بصلاحية PrintStudyDocuments.
 */
@Component({
  selector: 'app-study-design-approval-page',
  standalone: true,
  imports: [DatePipe, UtcPipe, RouterLink, Alert, EmptyState, Icon, StudyStatusChip, StudyApprovalsPanel, StudyDesignApprovalFormDialog],
  templateUrl: './study-design-approval-page.html',
  styleUrls: ['../../../../shared/styles/page-base.scss', '../../../../shared/styles/list-tools.scss'],
  styles: [`.title { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; } .title .mono { font-size: inherit; }
    .pre { white-space: pre-line; overflow-wrap: anywhere; }
    .danger-zone { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .danger-zone h2 { font-size: 16px; margin: 0 0 4px; } .danger-zone p { margin: 0; font-size: 13px; color: var(--ink-500); }`]
})
export class StudyDesignApprovalPage {
  private service = inject(StudyDrawingsService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private latest = latestRequest();

  id = signal(0);
  cda = signal<DesignApproval | null>(null);
  loading = signal(false);
  error = signal('');
  busy = signal(false);
  actionError = signal('');
  editing = signal(false);

  canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintStudyDocuments));
  canDelete = computed(() => !!this.cda()?.canEdit && this.auth.hasPermission(AppPermission.DeleteDesignApproval));
  /** القرار: معتمد/مرفوض بلون الشارة (نفس ألوان قرار التوقيع) */
  decisionKind = 'decision' as const;

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id.set(Number(p.get('id')));
      this.cda.set(null); this.editing.set(false);
      this.load();
    });
  }

  load() { this.latest(this.service.designApproval(this.id()), this.loading, this.error, d => this.cda.set(d)); }

  edited(d: DesignApproval) { this.editing.set(false); this.cda.set(d); this.toast.success('تم الحفظ'); }
  decided() { this.toast.success('حُفظ القرار'); this.load(); }

  async remove() {
    const d = this.cda()!;
    if (!await this.confirm.ask(`حذف ${d.cdaNumber}؟ تعود النسخة قيد الإعداد ولا يمكن التراجع.`, 'حذف')) return;
    this.run(this.service.removeDesignApproval(d.id), () => { this.toast.success('حُذف الاعتماد'); this.router.navigate(['/studies/drawings', d.drawingId]); });
  }

  private run<T>(call: Observable<T>, done: (value: T) => void) { trackRequest(call, this.busy, this.actionError, done); }
}
