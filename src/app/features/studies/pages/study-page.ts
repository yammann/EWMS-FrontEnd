import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { ProjectUploader, ProjectsService, type ProjectMember, type UploadJob } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { fileSize } from '@core/utils/file-size';
import { DeliverableDialog } from '../components/deliverable-dialog';
import { StudyFormDialog } from '../components/study-form-dialog';
import { CENTER_DECISION, DELIVERABLE_STATE, DeliverableInput, DeliverableType, STUDY_STATUS, Study, StudyDeliverable, StudyInput, StudySubmission } from '../data-access/studies.models';
import { StudiesService } from '../data-access/studies.service';

type Tab = 'deliverables' | 'submissions' | 'tasks';
type Dialog =
  | { kind: 'edit' } | { kind: 'add' } | { kind: 'editDeliverable'; d: StudyDeliverable }
  | { kind: 'review'; d: StudyDeliverable } | { kind: 'sendBack'; d: StudyDeliverable } | { kind: 'upload'; d: StudyDeliverable }
  | { kind: 'send' } | { kind: 'decide'; s: StudySubmission };

/** رفع جارٍ لملف مخرج: الأول ينشئ وثيقة تُربط بالمخرج عند اكتمال الرفع، والتالي يضيف إصداراً إلى وثيقته */
interface PendingUpload { job: UploadJob; deliverableId: number; title: string; attach: boolean; handled: boolean; }

/**
 * صفحة أمر الدراسة: مخرجات المكاتب الفنية (إعداد ← مراجعة ← معتمد أو معاد)، الإرسال إلى المركزية وقرارها (يدوياً)، والمهام المرتبطة.
 * الأزرار كلها تتبع أعلام الخادم (canPrepare، canReview، canSend…) فلا تكرّر الواجهة قواعد من يحق له ماذا؛ والمراجع غير المُعِدّ.
 * ملف المخرج يُرفع بالرفع المجزّأ الموجود (في الخلفية) ثم يُربط بالمخرج تلقائياً، ويصير الإصدار المعتمد معتمداً في إضبارة المشروع أيضاً.
 */
@Component({
  selector: 'app-study-page', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, Alert, EmptyState, Icon, Modal, UtcPipe, LinkedTasks, StudyFormDialog, DeliverableDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './study-page.scss'],
  templateUrl: './study-page.html'
})
export class StudyPage {
  private service = inject(StudiesService);
  private projects = inject(ProjectsService);
  private uploader = inject(ProjectUploader);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  st = STUDY_STATUS;
  ds = DELIVERABLE_STATE;
  center = CENTER_DECISION;
  size = fileSize;

  study = signal<Study | null>(null);
  loading = signal(false);
  error = signal('');
  types = signal<DeliverableType[]>([]);
  members = signal<ProjectMember[]>([]);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs: { key: Tab; label: string }[] = [{ key: 'deliverables', label: 'المخرجات' }, { key: 'submissions', label: 'الإرسال للمركزية' }, { key: 'tasks', label: 'المهام' }];
  tab = computed<Tab>(() => this.tabs.find(t => t.key === this.tabParam())?.key ?? 'deliverables');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');
  note = '';
  decision: number = CENTER_DECISION.approved;
  file = signal<File | null>(null);

  pending = signal<PendingUpload[]>([]);

  /** آخر جولة وقرارها (لتنبيه الحالة) */
  lastRound = computed(() => this.study()?.submissions.at(-1) ?? null);
  pendingRound = computed(() => this.study()?.submissions.find(s => s.decision === CENTER_DECISION.pending) ?? null);

  constructor() {
    this.route.paramMap.subscribe(p => this.load(Number(p.get('id'))));
  }

  /** عند اكتمال رفع (أو فشله) يُعالَج مرة واحدة: الربط بالمخرج أو إعادة القراءة */
  private watchUploads = effect(() => {
    for (const p of this.pending()) {
      const phase = p.job.phase();
      if (p.handled || (phase !== 'done' && phase !== 'failed')) continue;
      p.handled = true;
      untracked(() => phase === 'done' ? this.afterUpload(p) : this.toast.error(`تعذّر رفع الملف: ${p.job.error() || 'خطأ غير معروف'}`));
    }
  });

  load(id = this.study()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, s => this.study.set(s));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'deliverables' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  // ─────────── النوافذ ───────────
  open(dialog: Dialog) {
    this.formError.set(''); this.note = ''; this.file.set(null); this.decision = CENTER_DECISION.approved;
    if (dialog.kind === 'add' || dialog.kind === 'editDeliverable' || dialog.kind === 'upload') this.loadHelpers();
    this.dialog.set(dialog);
  }

  /** أنواع المخرجات (للنوع ولنوع وثيقة الملف) ومشاركو المشروع (للمهندس المسؤول) */
  private loadHelpers() {
    const s = this.study()!;
    if (!this.types().length) this.service.types(s.branchId, true).subscribe({ next: t => this.types.set(t), error: () => this.types.set([]) });
    if (!this.members().length) this.projects.get(s.projectId).subscribe({ next: p => this.members.set(p.members ?? []), error: () => this.members.set([]) });
  }

  private done(message: string) {
    return (s: Study) => { this.study.set(s); this.dialog.set(null); this.toast.success(message); };
  }

  // ─────────── الأمر ───────────
  saveStudy(body: StudyInput) { trackRequest(this.service.update(this.study()!.id, body), this.saving, this.formError, this.done('حُفظت التعديلات')); }

  async cancelStudy() {
    const s = this.study()!;
    if (!(await this.confirm.ask(`إلغاء أمر الدراسة «${s.title}»؟ يبقى أثره ولا يُحذف.`, 'إلغاء الأمر'))) return;
    trackRequest(this.service.cancel(s.id, s.rowVersion), this.saving, this.error, this.done('أُلغي أمر الدراسة'));
  }

  reopen() { const s = this.study()!; trackRequest(this.service.reopen(s.id, s.rowVersion), this.saving, this.error, this.done('فُتحت جولة جديدة')); }

  // ─────────── المخرجات ───────────
  saveDeliverable(body: DeliverableInput) {
    const dialog = this.dialog();
    const s = this.study()!;
    const request = dialog?.kind === 'editDeliverable' ? this.service.updateDeliverable(dialog.d.id, body) : this.service.addDeliverable(s.id, body);
    trackRequest(request, this.saving, this.formError, this.done(dialog?.kind === 'editDeliverable' ? 'حُفظ المخرج' : 'أُضيف المخرج'));
  }

  async removeDeliverable(d: StudyDeliverable) {
    if (!(await this.confirm.ask(`حذف المخرج «${d.typeName}»؟`, 'حذف'))) return;
    trackRequest(this.service.removeDeliverable(d.id), this.saving, this.error, this.done('حُذف المخرج'));
  }

  submitForReview(d: StudyDeliverable) {
    trackRequest(this.service.submitDeliverable(d.id, d.rowVersion), this.saving, this.error, this.done('رُفع المخرج للمراجعة'));
  }

  review(approve: boolean) {
    const dialog = this.dialog();
    if (dialog?.kind !== 'review') return;
    if (!approve && !this.note.trim()) { this.formError.set('اكتب سبب إعادة المخرج'); return; }
    trackRequest(this.service.review(dialog.d.id, approve, this.note, dialog.d.rowVersion), this.saving, this.formError, this.done(approve ? 'اعتُمد المخرج' : 'أُعيد المخرج'));
  }

  sendBack() {
    const dialog = this.dialog();
    if (dialog?.kind !== 'sendBack') return;
    if (!this.note.trim()) { this.formError.set('اكتب سبب إعادة المخرج لجولة جديدة'); return; }
    trackRequest(this.service.sendBack(dialog.d.id, this.note, dialog.d.rowVersion), this.saving, this.formError, this.done('أُعيد المخرج لجولة جديدة'));
  }

  // ─────────── ملف المخرج ───────────
  choose(list: FileList | null) { this.file.set(list?.[0] ?? null); }

  startUpload() {
    const dialog = this.dialog(), file = this.file(), s = this.study();
    if (dialog?.kind !== 'upload' || !file || !s) return;
    const d = dialog.d;
    const type = this.types().find(t => t.id === d.typeId);
    const title = d.documentId ? d.typeName : `${d.typeName} — ${s.number} — ${Date.now().toString(36)}`;
    const job = this.uploader.add(file, {
      projectId: s.projectId, documentId: d.documentId, title, kind: type?.documentKind ?? 99, fileName: file.name, size: file.size, source: '', note: this.note.trim()
    });
    this.pending.update(list => [...list, { job, deliverableId: d.id, title, attach: !d.documentId, handled: false }]);
    this.dialog.set(null);
    this.toast.info('بدأ رفع الملف في الخلفية');
  }

  uploadsFor(deliverableId: number) { return this.pending().filter(p => p.deliverableId === deliverableId && !p.job.isFinished()); }
  percent(job: UploadJob) { return Math.round(job.progress() * 100); }

  private afterUpload(p: PendingUpload) {
    if (!p.attach) { this.load(); this.toast.success('أُضيف إصدار جديد إلى ملف المخرج'); return; }
    const s = this.study();
    if (!s) return;
    this.projects.documents({ projectId: s.projectId, kind: null, search: p.title, from: '', to: '', page: 1, pageSize: 5 }).subscribe({
      next: page => {
        const doc = page.items.find(x => x.title === p.title);
        const d = this.study()?.deliverables.find(x => x.id === p.deliverableId);
        if (!doc || !d) { this.toast.error('اكتمل الرفع لكن تعذّر ربط الملف بالمخرج: ارفعه من «الوثائق» ثم أعد المحاولة'); return; }
        this.service.attachDocument(d.id, doc.id, d.rowVersion).subscribe({
          next: updated => { this.study.set(updated); this.toast.success('رُبط الملف بالمخرج'); },
          error: e => this.toast.error((e as { message?: string }).message ?? 'تعذّر ربط الملف')
        });
      },
      error: () => this.toast.error('اكتمل الرفع لكن تعذّر ربط الملف بالمخرج')
    });
  }

  // ─────────── المركزية ───────────
  send() { const s = this.study()!; trackRequest(this.service.send(s.id, this.note, s.rowVersion), this.saving, this.formError, this.done('سُجّل الإرسال إلى المركزية')); }

  decide() {
    const dialog = this.dialog();
    if (dialog?.kind !== 'decide') return;
    if (this.decision === CENTER_DECISION.notes && !this.note.trim()) { this.formError.set('اكتب ملاحظات المركزية'); return; }
    trackRequest(this.service.decide(dialog.s.id, this.decision, this.note, dialog.s.rowVersion), this.saving, this.formError,
      this.done(this.decision === CENTER_DECISION.approved ? 'سُجّل اعتماد المركزية' : 'سُجّلت ملاحظات المركزية'));
  }

  // ─────────── العرض ───────────
  stateClass(d: StudyDeliverable) {
    return d.state === DELIVERABLE_STATE.approved ? 'pill ok' : d.state === DELIVERABLE_STATE.returned ? 'pill warn' : d.state === DELIVERABLE_STATE.inReview ? 'pill info' : 'pill';
  }
  statusClass(s: Study) { return s.status === STUDY_STATUS.cancelled ? 'pill muted' : s.isOverdue ? 'pill pill-late' : 'pill'; }
}
