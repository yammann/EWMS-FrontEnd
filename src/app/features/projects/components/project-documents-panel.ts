import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { DOCUMENT_KINDS, DocumentFilter, DocumentVersion, ProjectDocument, UPLOAD_RECEIVING, UploadSession } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';
import { PREVIEW_LIMIT_BYTES, ProjectFiles } from '../data-access/project-files.service';
import { ProjectUploader, UploadJob } from '../data-access/project-uploader.service';
import { bigFileSize, formatEta } from '../utils/upload-plan';
import { DocumentUploadDialog } from './document-upload-dialog';

const PAGE_SIZE = 15;

/**
 * وثائق إضبارة المشروع (projectId) أو بحث عام في وثائق كل المشاريع المرئية (projectId = null).
 * كل رفع يضيف إصداراً ولا يستبدل شيئاً؛ الاعتماد على غير من رفع؛ ما فيه إصدار معتمد لا يُحذف؛ وفتح المعتمد يُسجَّل في التدقيق.
 */
@Component({
  selector: 'app-project-documents-panel', standalone: true,
  imports: [DatePipe, RouterLink, Alert, EmptyState, Icon, Modal, Pager, SelectValue, UtcPipe, DocumentUploadDialog],
  styleUrls: ['../../../shared/styles/data-tools.scss', './project-documents-panel.scss'],
  templateUrl: './project-documents-panel.html'
})
export class ProjectDocumentsPanel implements OnDestroy {
  private service = inject(ProjectsService);
  private files = inject(ProjectFiles);
  private uploader = inject(ProjectUploader);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private latest = latestRequest();

  /** إضبارة مشروع؛ null = بحث عام */
  projectId = input<number | null>(null);
  /** المشروع مفتوح (غير مغلق/ملغى): يُسمح بالرفع والاعتماد والحذف */
  open = input(true);
  /** تغيّر شيء (رفع/اعتماد/حذف): تُعاد قراءة السجل في الصفحة الأم */
  changed = output<void>();

  access = this.service.access;
  kinds = DOCUMENT_KINDS;
  size = bigFileSize;
  eta = formatEta;
  downloading = this.files.downloading;

  filter = signal<DocumentFilter>({ projectId: null, kind: null, search: '', from: '', to: '', page: 1, pageSize: PAGE_SIZE });
  items = signal<ProjectDocument[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** الوثائق المفتوحة إصداراتها (بتفاصيلها الكاملة) */
  expanded = signal<ReadonlyMap<number, ProjectDocument>>(new Map());
  busyId = signal<number | null>(null);

  uploadDialog = signal<{ document: ProjectDocument | null } | null>(null);
  jobs = computed(() => this.uploader.forProject(this.projectId()));
  /** رفوعات بدأت ثم انقطعت (بعد تحديث الصفحة مثلاً): تُستأنف باختيار الملف نفسه */
  pending = signal<UploadSession[]>([]);
  resumeError = signal('');

  preview = signal<{ version: DocumentVersion; title: string } | null>(null);
  previewUrl = signal<string | null>(null);
  previewSafe = signal<SafeResourceUrl | null>(null);
  previewError = signal('');

  canUpload = computed(() => this.access().canUpload && this.open() && this.projectId() != null);

  constructor() {
    effect(() => {
      const id = this.projectId();
      untracked(() => { this.filter.update(f => ({ ...f, projectId: id, page: 1 })); this.load(); this.loadPending(); });
    });
    // اكتمل رفع (لهذا المشروع أو لأي مشروع في البحث العام): أعد القراءة
    effect(() => {
      const n = this.uploader.completed();
      const project = this.uploader.lastCompletedProjectId();
      if (n === 0) return;
      untracked(() => {
        if (this.projectId() == null || this.projectId() === project) { this.load(); this.loadPending(); this.changed.emit(); }
      });
    });
  }

  ngOnDestroy() { this.releasePreview(); }

  // ───────────────────────── القائمة ─────────────────────────

  load() {
    this.latest(this.service.documents(this.filter()), this.loading, this.error, page => {
      this.items.set(page.items); this.total.set(page.totalCount);
    });
  }

  setFilter(patch: Partial<DocumentFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  hasFilters() { const f = this.filter(); return !!(f.search || f.kind || f.from || f.to); }
  clearFilters() { this.setFilter({ search: '', kind: null, from: '', to: '' }); }

  private loadPending() {
    const id = this.projectId();
    if (id == null || !this.access().canUpload) { this.pending.set([]); return; }
    this.service.myUploads(id).subscribe({
      next: list => this.pending.set(list.filter(s => s.status === UPLOAD_RECEIVING && !this.uploader.jobs().some(j => j.session?.id === s.id))),
      error: () => this.pending.set([])
    });
  }

  // ───────────────────────── الإصدارات ─────────────────────────

  toggle(doc: ProjectDocument) {
    const map = new Map(this.expanded());
    if (map.has(doc.id)) { map.delete(doc.id); this.expanded.set(map); return; }
    this.service.document(doc.id).subscribe({
      next: full => { const next = new Map(this.expanded()); next.set(doc.id, full); this.expanded.set(next); },
      error: e => this.error.set(e.message)
    });
  }

  /** الصف المعروض بعد تحديثه من الخادم (اعتماد مثلاً) */
  private replace(full: ProjectDocument) {
    this.items.update(list => list.map(d => (d.id === full.id ? { ...full, versions: null } : d)));
    if (this.expanded().has(full.id)) { const next = new Map(this.expanded()); next.set(full.id, full); this.expanded.set(next); }
  }

  /** الإصدار الذي يُفتح افتراضياً: المعتمد إن وُجد وإلا الأحدث */
  primary(doc: ProjectDocument): DocumentVersion | null { return doc.approved ?? doc.latest; }

  approve(doc: ProjectDocument, v: DocumentVersion) {
    void this.confirm.ask(`اعتماد الإصدار ${v.versionNumber} من «${doc.title}»؟ لا يُعدَّل ولا يُحذف بعد اعتماده، ويُسجَّل اعتمادك باسمك.`, 'اعتماد').then(ok => {
      if (!ok) return;
      this.busyId.set(v.id);
      this.service.approve(v.id).subscribe({
        next: full => { this.busyId.set(null); this.replace(full); this.toast.success('اعتُمد الإصدار'); this.changed.emit(); },
        error: e => { this.busyId.set(null); this.toast.error(e.message ?? 'تعذّر الاعتماد'); }
      });
    });
  }

  async remove(doc: ProjectDocument) {
    if (!(await this.confirm.ask(`حذف وثيقة «${doc.title}» بكل إصداراتها؟ يبقى أثر الحذف في سجل التدقيق، ولا يُحذف ما فيه إصدار معتمد.`, 'حذف'))) return;
    this.busyId.set(doc.id);
    this.service.deleteDocument(doc.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.items.update(list => list.filter(d => d.id !== doc.id));
        this.total.update(n => Math.max(0, n - 1));
        this.toast.success('حُذفت الوثيقة'); this.changed.emit();
      },
      error: e => { this.busyId.set(null); this.toast.error(e.message ?? 'تعذّر الحذف'); }
    });
  }

  // ───────────────────────── فتح الملف ─────────────────────────

  async download(v: DocumentVersion) {
    if (!this.files.canDownload(v.size)) { this.toast.error('الملف كبير: استعمل متصفح Chrome أو Edge لتنزيله مباشرة على القرص'); return; }
    try { await this.files.download(v); this.changed.emit(); }
    catch (e) { this.toast.error((e as Error).message || 'تعذّر تنزيل الملف'); }
  }

  canPreview(v: DocumentVersion) { return v.previewable && v.size <= PREVIEW_LIMIT_BYTES; }

  async openPreview(doc: ProjectDocument, v: DocumentVersion) {
    this.releasePreview();
    this.preview.set({ version: v, title: doc.title });
    this.previewError.set('');
    try {
      const url = URL.createObjectURL(await this.files.blob(v));
      if (this.preview()?.version.id !== v.id) { URL.revokeObjectURL(url); return; }
      this.previewUrl.set(url);
      this.previewSafe.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.changed.emit();
    } catch (e) { this.previewError.set((e as Error).message || 'تعذّر فتح الملف'); }
  }

  closePreview() { this.preview.set(null); this.releasePreview(); }

  private releasePreview() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null); this.previewSafe.set(null);
  }

  // ───────────────────────── الرفع ─────────────────────────

  uploadPercent(job: UploadJob) { return Math.round(job.progress() * 100); }
  speedText(job: UploadJob) { return job.speed() > 0 ? `${bigFileSize(job.speed())}/ث` : ''; }
  pause(job: UploadJob) { this.uploader.pause(job); }
  resume(job: UploadJob) { this.uploader.resume(job); }
  cancel(job: UploadJob) { void this.uploader.cancel(job); }
  dismiss(job: UploadJob) { this.uploader.dismiss(job); }

  resumePending(session: UploadSession, picker: HTMLInputElement) {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    const result = this.uploader.resumeSession(file, session);
    if (typeof result === 'string') { this.resumeError.set(result); return; }
    this.resumeError.set('');
    this.pending.update(list => list.filter(s => s.id !== session.id));
  }

  discardPending(session: UploadSession) {
    this.service.cancelUpload(session.id).subscribe({ next: () => this.pending.update(list => list.filter(s => s.id !== session.id)), error: e => this.toast.error(e.message) });
  }

}
