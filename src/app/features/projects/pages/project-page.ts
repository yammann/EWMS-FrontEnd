import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProjectCorrespondence } from '@features/diwan';
import { ProjectStudies } from '@features/studies';
import { ProjectContracts } from '@features/contracts';
import { ProjectHandovers } from '@features/handover';
import { LinkedTasks } from '@features/task-board';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { AuthService } from '@core/services/auth.service';
import { CONTRACT_ACCESS, DIWAN_ACCESS, HANDOVER_ACCESS, STUDY_ACCESS } from '@core/constants/access';
import { ProjectAuditPanel } from '../components/project-audit-panel';
import { ProjectDocumentsPanel } from '../components/project-documents-panel';
import { ProjectFormDialog } from '../components/project-form-dialog';
import { ProjectMembersPanel } from '../components/project-members-panel';
import { ProjectSchedulePanel } from '../components/project-schedule-panel';
import { Project, ProjectInput } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';

type Tab = 'overview' | 'documents' | 'schedule' | 'studies' | 'contracts' | 'handover' | 'correspondence' | 'tasks' | 'members' | 'audit';

/**
 * صفحة المشروع (إضبارته): نظرة عامة، الوثائق بإصداراتها، المهام المرتبطة، المشاركون، وسجل التدقيق.
 * التبويب في الرابط (?tab=) فيُشارَك ويبقى عند التحديث. المشروع المغلق أو الملغى للقراءة حتى تُعاد فتحه بتغيير مرحلته.
 */
@Component({
  selector: 'app-project-page', standalone: true,
  imports: [DatePipe, Alert, EmptyState, UtcPipe, LinkedTasks, ProjectCorrespondence, ProjectStudies, ProjectContracts, ProjectHandovers, ProjectAuditPanel, ProjectDocumentsPanel, ProjectFormDialog, ProjectMembersPanel, ProjectSchedulePanel],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './project-page.scss'],
  templateUrl: './project-page.html'
})
export class ProjectPage {
  private service = inject(ProjectsService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  project = signal<Project | null>(null);
  loading = signal(false);
  error = signal('');

  /** يتغير عند كل تعديل في المشروع أو وثائقه فيُعاد تحميل سجل التدقيق */
  auditKey = signal(0);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs = computed<{ key: Tab; label: string }[]>(() => [
    { key: 'overview', label: 'نظرة عامة' },
    ...(this.access().canViewDocuments ? [{ key: 'documents' as const, label: 'الوثائق' }] : []),
    ...(this.access().canViewSchedule ? [{ key: 'schedule' as const, label: 'الجدول الزمني' }] : []),
    ...(this.auth.hasAnyPermission(STUDY_ACCESS) ? [{ key: 'studies' as const, label: 'الدراسة' }] : []),
    ...(this.auth.hasAnyPermission(CONTRACT_ACCESS) ? [{ key: 'contracts' as const, label: 'العقود' }] : []),
    ...(this.auth.hasAnyPermission(HANDOVER_ACCESS) ? [{ key: 'handover' as const, label: 'الاستلام' }] : []),
    ...(this.auth.hasAnyPermission(DIWAN_ACCESS) ? [{ key: 'correspondence' as const, label: 'المعاملات' }] : []),
    { key: 'tasks', label: 'المهام' },
    { key: 'members', label: 'المشاركون' },
    ...(this.access().canViewAudit ? [{ key: 'audit' as const, label: 'سجل التدقيق' }] : [])
  ]);
  tab = computed<Tab>(() => {
    const wanted = this.tabParam();
    return this.tabs().find(t => t.key === wanted)?.key ?? 'overview';
  });

  /** يُسمح بالتعديل والإضافة ما دام المشروع غير مغلق/ملغى */
  isOpen = computed(() => !!this.project() && !this.project()!.isFinished);
  canEdit = computed(() => !!this.project()?.canEdit);

  editing = signal(false);
  saving = signal(false);
  formError = signal('');

  constructor() {
    this.route.paramMap.subscribe(p => this.load(Number(p.get('id'))));
  }

  load(id = this.project()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, p => this.project.set(p));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'overview' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  openEdit() { this.formError.set(''); this.editing.set(true); }

  save(body: ProjectInput) {
    const p = this.project();
    if (!p) return;
    trackRequest(this.service.update(p.id, body), this.saving, this.formError, updated => {
      this.project.set(updated); this.editing.set(false); this.auditKey.update(n => n + 1);
      this.toast.success('حُفظت التعديلات');
    });
  }

  /** عضوية المشاركين تغيّرت: الصفحة تعرض المشروع المحدَّث */
  membersChanged(p: Project) { this.project.set(p); this.auditKey.update(n => n + 1); }
  documentsChanged() { this.auditKey.update(n => n + 1); }
  scheduleChanged() { this.auditKey.update(n => n + 1); }

  stageClass(stage: number) { return stage === 6 || stage === 7 ? 'pill muted' : stage === 3 ? 'pill pill-active' : 'pill'; }
}
