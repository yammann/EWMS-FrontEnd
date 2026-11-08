import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { AuthService } from '@core/services/auth.service';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { StudyApprovalsPanel } from '../components/approvals-panel';
import { StudyProgress } from '../components/progress-bar';
import { StudyProjectFormDialog } from '../components/project-form-dialog';
import { StudyProjectDrawingsPanel } from '../components/project-drawings-panel';
import { StudyProjectStagesPanel } from '../components/project-stages-panel';
import { StudyProjectTeamPanel } from '../components/project-team-panel';
import { StudyReasonDialog } from '../components/reason-dialog';
import { StudyActivity } from '../components/study-activity';
import { StudyAttachments } from '../components/study-attachments';
import { StudyChainView } from '../components/study-chain';
import { StudyGantt } from '../components/study-gantt';
import { StudyStatusChip } from '../components/study-status-chip';
import { StudyAccess } from '../data-access/study-access';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StageTask, StudyOwnerType, StudyProject } from '../data-access/studies.models';

type Tab = 'stages' | 'gantt' | 'team' | 'drawings' | 'more';
type Dialog = 'edit' | 'cancel' | null;
const TABS: { key: Tab; label: string }[] = [
  { key: 'stages', label: 'المراحل والمهام' }, { key: 'gantt', label: 'المخطط الزمني' }, { key: 'team', label: 'الفريق' }, { key: 'drawings', label: 'المخططات' }, { key: 'more', label: 'التواقيع والمرفقات والسجل' }
];
const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';

/**
 * صفحة مشروع دراسة: ترويسة بنسبة الإنجاز وإجراءات المشروع (تعديل، طلب الإنجاز، إلغاء، حذف)، ثم تبويبات:
 * المراحل والمهام، المخطط الزمني (Gantt)، الفريق، والتواقيع والمرفقات والسجل. المشروع ومهامه يُحمَّلان معاً
 * ويُعاد تحميلهما بعد أي تغيير في المراحل والمهام؛ وعمليات الفريق تعيد المشروع كاملاً. الأعلام من الخادم.
 */
@Component({
  selector: 'app-study-project-page',
  standalone: true,
  imports: [
    DatePipe, UtcPipe, RouterLink, Alert, EmptyState, Icon, StudyChainView, StudyStatusChip, StudyProgress, StudyApprovalsPanel,
    StudyProjectFormDialog, StudyProjectStagesPanel, StudyProjectTeamPanel, StudyProjectDrawingsPanel, StudyGantt, StudyReasonDialog, StudyAttachments, StudyActivity
  ],
  templateUrl: './study-project-page.html',
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/list-tools.scss', './study-project-page.scss']
})
export class StudyProjectPage {
  private service = inject(StudyProjectsService);
  private documents = inject(StudyDocumentsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private latest = latestRequest();

  tabs = TABS;
  fmt = day;
  ownerType = 5 as StudyOwnerType;
  access = inject(StudyAccess).can;

  id = signal(0);
  project = signal<StudyProject | null>(null);
  tasks = signal<StageTask[]>([]);
  loading = signal(false);
  error = signal('');
  busy = signal(false);
  actionError = signal('');
  dialog = signal<Dialog>(null);
  tab = signal<Tab>('stages');
  logVersion = signal(0);

  /** المخططات: تظهر لمن يملك عرضها فقط */
  visibleTabs = computed(() => TABS.filter(t => t.key !== 'drawings' || this.access().viewDrawings));

  /** الإرفاق: تعديل المشروع، وأن لا يكون ملغى */
  canAttach = computed(() => {
    const p = this.project();
    return !!p && p.status !== 4 && this.auth.hasPermission(AppPermission.EditStudyProject);
  });
  logKey = computed(() => [this.logVersion(), this.project()]);

  /** رقم الرد RSP لبطاقة «إشعار الرد» في السلسلة */
  responseNumber = signal<string | null>(null);

  constructor() {
    effect(() => {
      const p = this.project();
      untracked(() => this.documents.responseNumberOf(p?.chain).subscribe(n => this.responseNumber.set(n)));
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id.set(Number(p.get('id')));
      this.project.set(null); this.tasks.set([]);
      this.load();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const wanted = p.get('tab') as Tab | null;
      this.tab.set(wanted && TABS.some(t => t.key === wanted) ? wanted : 'stages');
    });
  }

  setTab(tab: Tab) {
    this.router.navigate([], { queryParams: { tab: tab === 'stages' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  load() {
    const id = this.id();
    this.latest(forkJoin({ project: this.service.get(id), tasks: this.service.projectTasks(id) }), this.loading, this.error, r => {
      this.project.set(r.project); this.tasks.set(r.tasks); this.logVersion.update(v => v + 1);
    });
  }

  /** عملية على المراحل والمهام نجحت: يُعاد تحميل المشروع ومهامه */
  reload() { this.load(); }

  teamUpdated(p: StudyProject) { this.project.set(p); this.logVersion.update(v => v + 1); }
  decided() { this.toast.success('حُفظ القرار'); this.load(); }

  edited(p: StudyProject) { this.dialog.set(null); this.project.set(p); this.toast.success('تم الحفظ'); this.logVersion.update(v => v + 1); }

  async requestCompletion() {
    if (!await this.confirm.ask('إرسال إنجاز المشروع للاعتماد؟ يوقّع عليه إدارة المشاريع ثم رئيس الفرع.', 'إرسال')) return;
    this.run(this.service.requestCompletion(this.id()), p => { this.project.set(p); this.toast.success('أُرسل الإنجاز للاعتماد'); this.logVersion.update(v => v + 1); });
  }

  cancelProject(reason: string) {
    this.run(this.service.cancel(this.id(), reason), p => { this.project.set(p); this.dialog.set(null); this.toast.success('أُلغي المشروع'); this.logVersion.update(v => v + 1); });
  }

  async remove() {
    if (!await this.confirm.ask(`حذف المشروع «${this.project()?.code}»؟ لا يُحذف مشروع له مهام أو مخططات أو مرفقات.`, 'حذف')) return;
    this.run(this.service.remove(this.id()), () => { this.toast.success('حُذف المشروع'); this.router.navigate(['/studies/projects']); });
  }

  private run<T>(call: Observable<T>, done: (value: T) => void) { trackRequest(call, this.busy, this.actionError, done); }
}
