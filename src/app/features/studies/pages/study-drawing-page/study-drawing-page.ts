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
import { StudyDesignApprovalFormDialog, CdaVersion } from '../../components/design-approval-form-dialog';
import { StudyDrawingFormDialog } from '../../components/drawing-form-dialog';
import { StudyDrawingReviewDialog } from '../../components/drawing-review-dialog';
import { StudyActivity } from '../../components/study-activity';
import { StudyAttachments } from '../../components/study-attachments';
import { StudyStatusChip } from '../../components/study-status-chip';
import { StudyVersionFormDialog } from '../../components/version-form-dialog';
import { StudyAccess } from '../../data-access/study-access';
import { StudyDocumentsService } from '../../data-access/study-documents.service';
import { StudyDrawingsService } from '../../data-access/study-drawings.service';
import { StudyProjectsService } from '../../data-access/study-projects.service';
import { ArchitecturalVersion, BasisOption, StudyActivityLog, StudyDrawing, StudyOwnerType, StudyProject } from '../../data-access/studies.models';

type Dialog = 'edit' | 'version' | 'cda' | 'review' | null;
const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';

/**
 * صفحة مخطط: بياناته، ونسخه (للمعماري) مع إصدار CDA لكل نسخة، ومراجعته (لغير المعماري)، ومرفقاته.
 * المعماري: نسخ Draft-N بنسخة واحدة قيد الإعداد في كل وقت، ولكل نسخة اعتماد أولي واحد يعتمدها بثلاثة تواقيع.
 * غير المعماري: يُرسَل للمراجعة (الحالة بانتظار المراجعة) ثم يعتمده من يملك ReviewStudyDrawing أو يرفضه بملاحظة.
 * الأعلام (canEdit، canReview) من الخادم، والتعديل للقسم المُصدِر وحده.
 */
@Component({
  selector: 'app-study-drawing-page',
  standalone: true,
  imports: [
    DatePipe, UtcPipe, RouterLink, Alert, EmptyState, Icon, StudyStatusChip, StudyAttachments, StudyDrawingFormDialog,
    StudyVersionFormDialog, StudyDesignApprovalFormDialog, StudyDrawingReviewDialog, StudyActivity
  ],
  templateUrl: './study-drawing-page.html',
  styleUrls: ['../../../../shared/styles/page-base.scss', '../../../../shared/styles/list-tools.scss', './study-drawing-page.scss']
})
export class StudyDrawingPage {
  private service = inject(StudyDrawingsService);
  private projects = inject(StudyProjectsService);
  private documents = inject(StudyDocumentsService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private latest = latestRequest();

  access = inject(StudyAccess).can;
  fmt = day;
  drawingOwner = 8 as StudyOwnerType;
  versionOwner = 9 as StudyOwnerType;

  id = signal(0);
  drawing = signal<StudyDrawing | null>(null);
  project = signal<StudyProject | null>(null);
  basis = signal<BasisOption[]>([]);
  loading = signal(false);
  error = signal('');
  busy = signal(false);
  actionError = signal('');
  dialog = signal<Dialog>(null);
  editingVersion = signal<ArchitecturalVersion | null>(null);
  cdaFor = signal<CdaVersion | null>(null);
  /** آخر قرار مراجعة رفض هذا المخطط (من سجل الدراسة): سببه يراه القسم المُصدِر لتعديله */
  rejection = signal<StudyActivityLog | null>(null);
  /** أحداث هذا المخطط ونسخه فقط من سجل الدراسة */
  logFilter = computed(() => {
    const d = this.drawing();
    const versions = new Set((d?.versions ?? []).map(v => v.id));
    return (e: StudyActivityLog) => (e.entityType === 8 && e.entityId === d?.id) || (e.entityType === 9 && versions.has(e.entityId));
  });
  /** نسخة تُعرض مرفقاتها */
  filesOf = signal<number | null>(null);

  isArchitectural = computed(() => this.drawing()?.kind === 1);
  /** تعديل المخطط ومرفقاته: القسم المُصدِر (علم الخادم) بصلاحية التعديل */
  canAttach = computed(() => !!this.drawing()?.canEdit && this.auth.hasPermission(AppPermission.EditStudyDrawing));
  canEditVersions = computed(() => !!this.drawing()?.canEdit && this.auth.hasPermission(AppPermission.EditArchitecturalVersion));
  /** النسخة قيد الإعداد الحالية (لا تُنشأ نسخة جديدة معها) */
  hasOpenVersion = computed(() => (this.drawing()?.versions ?? []).some(v => v.status === 1 || v.status === 2));

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id.set(Number(p.get('id')));
      this.drawing.set(null); this.dialog.set(null);
      this.load();
    });
  }

  load() {
    this.latest(this.service.get(this.id()), this.loading, this.error, d => {
      this.drawing.set(d);
      if (this.project()?.id !== d.projectId) this.projects.get(d.projectId).subscribe({ next: p => { this.project.set(p); this.loadRejection(); }, error: () => undefined });
      else this.loadRejection();
    });
  }

  /** سبب الرفض من سجل الدراسة (يحتاج صلاحية عرضه؛ بدونها لا يظهر شيء) */
  private loadRejection() {
    const d = this.drawing(), requestId = this.project()?.chain?.requestId;
    this.rejection.set(null);
    if (!d || d.status !== 4 || !requestId || !this.access().viewActivityLog) return;
    this.documents.activityLog(requestId).subscribe({
      next: rows => this.rejection.set(rows.find(r => r.entityType === 8 && r.entityId === d.id && r.action === 5) ?? null),
      error: () => undefined
    });
  }

  /** نسخ المعماري المعتمدة (الأساس) تُجلب عند فتح نافذة التعديل لمخطط غير معماري */
  openEdit() {
    const d = this.drawing()!;
    if (d.kind === 1) { this.dialog.set('edit'); return; }
    this.service.approvedBasis(d.projectId).subscribe({
      next: list => { this.basis.set(list); this.dialog.set('edit'); },
      error: () => { this.basis.set([]); this.dialog.set('edit'); }
    });
  }

  set(d: StudyDrawing, message?: string) {
    this.drawing.set(d); this.dialog.set(null); this.editingVersion.set(null); this.cdaFor.set(null);
    if (message) this.toast.success(message);
  }

  async remove() {
    const d = this.drawing()!;
    if (!await this.confirm.ask(`حذف المخطط «${d.name}»؟ يُحذف قبل اعتماده فقط.`, 'حذف')) return;
    this.run(this.service.remove(d.id), () => { this.toast.success('حُذف المخطط'); this.router.navigate(['/studies/projects', d.projectId], { queryParams: { tab: 'drawings' } }); });
  }

  async removeVersion(v: ArchitecturalVersion) {
    if (!await this.confirm.ask(`حذف النسخة ${v.label}؟`, 'حذف')) return;
    this.run(this.service.removeVersion(v.id), d => this.set(d, 'حُذفت النسخة'));
  }

  openCda(v: ArchitecturalVersion) {
    this.cdaFor.set({ id: v.id, label: v.label, drawingName: this.drawing()!.name });
    this.dialog.set('cda');
  }

  cdaCreated(id: number) { this.dialog.set(null); this.cdaFor.set(null); this.toast.success('أُصدر اعتماد المخططات الأولي — تواقيعه الثلاثة بانتظار أصحابها'); this.router.navigate(['/studies/design-approvals', id]); }

  review(approve: boolean, note: string) {
    this.run(this.service.review(this.id(), { approve, note }), d => this.set(d, approve ? 'اعتُمد المخطط' : 'رُفض المخطط'));
  }

  private run<T>(call: Observable<T>, done: (value: T) => void) { trackRequest(call, this.busy, this.actionError, done); }
}
