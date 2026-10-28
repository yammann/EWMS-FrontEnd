import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { CorrespondenceAttachments } from '../components/correspondence-attachments';
import { ReferDialog } from '../components/refer-dialog';
import { RegisterDialog, RegisterMode, RegisterPayload } from '../components/register-dialog';
import { Correspondence, CorrespondenceStatus, HistoryEntry, INCOMING, OUTGOING, OUTGOING_STATES, ReferInput } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

type Tab = 'overview' | 'attachments' | 'tasks' | 'history';
type Panel = 'edit' | 'reply' | 'refer' | 'status' | 'decide' | null;

/** أسماء أفعال الأثر بالعربية (مفاتيح AuditActions في الخادم) */
const ACTION_AR: Record<string, string> = {
  created: 'تسجيل', updated: 'تعديل', referred: 'إحالة', acknowledged: 'استلام', stage: 'تغيير حالة', closed: 'إغلاق', reopened: 'إعادة فتح',
  submitted: 'رفع للاعتماد', approved: 'اعتماد', returned: 'إعادة', issued: 'إصدار', attached: 'إرفاق', deleted: 'حذف'
};

/**
 * صفحة المعاملة: بياناتها ووحدتها الحالية وإحالاتها، مرفقاتها، المهام المرتبطة بها، وأثر عملياتها.
 * الأزرار تتبع أعلام الخادم (canRefer، canApprove…) فلا تكرّر الواجهة قواعد من يحق له ماذا.
 * مسار الصادر: مسودة ← رفع للاعتماد ← اعتماد بتوقيع المعتمِد (أو إعادة بسبب) ← إصدار برقم، ثم طباعة الكتاب.
 */
@Component({
  selector: 'app-correspondence-page', standalone: true,
  imports: [DatePipe, FormsModule, Alert, EmptyState, Modal, UtcPipe, LinkedTasks, CorrespondenceAttachments, ReferDialog, RegisterDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './correspondence-page.scss'],
  templateUrl: './correspondence-page.html'
})
export class CorrespondencePage {
  private service = inject(DiwanService);
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  incoming = INCOMING;
  outgoing = OUTGOING;
  states = OUTGOING_STATES;

  item = signal<Correspondence | null>(null);
  loading = signal(false);
  error = signal('');
  statuses = signal<CorrespondenceStatus[]>([]);
  history = signal<HistoryEntry[]>([]);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' }, { key: 'attachments', label: 'المرفقات' }, { key: 'tasks', label: 'المهام' }, { key: 'history', label: 'السجل' }
  ];
  tab = computed<Tab>(() => this.tabs.find(t => t.key === this.tabParam())?.key ?? 'overview');

  panel = signal<Panel>(null);
  saving = signal(false);
  formError = signal('');
  statusChoice = 0;
  note = '';

  constructor() {
    this.route.paramMap.subscribe(p => this.load(Number(p.get('id'))));
  }

  load(id = this.item()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, c => { this.item.set(c); if (this.tab() === 'history') this.loadHistory(); });
  }

  private loadHistory() {
    const id = this.item()?.id;
    if (id) this.service.history(id).subscribe({ next: h => this.history.set(h), error: () => this.history.set([]) });
  }

  select(tab: Tab) {
    void this.router.navigate([], { queryParams: { tab: tab === 'overview' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
    if (tab === 'history') this.loadHistory();
  }

  open(panel: Panel) {
    this.formError.set(''); this.note = '';
    if (panel === 'status') {
      const c = this.item()!;
      this.statusChoice = c.statusId ?? 0;
      this.service.statuses(c.branchId).subscribe({ next: s => this.statuses.set(s), error: e => this.formError.set(e.message) });
    }
    this.panel.set(panel);
  }

  /** نتيجة كل عملية: التفصيل المحدَّث، وإغلاق النافذة، ورسالة نجاح */
  private done(message: string) {
    return (c: Correspondence) => { this.item.set(c); this.panel.set(null); this.toast.success(message); if (this.tab() === 'history') this.loadHistory(); };
  }

  save(body: RegisterPayload) {
    const c = this.item()!;
    trackRequest(this.service.update(c.id, { ...body, replyToId: c.replyToId, rowVersion: c.rowVersion }), this.saving, this.formError, this.done('حُفظت التعديلات'));
  }

  reply(body: RegisterPayload) {
    const c = this.item()!;
    trackRequest(this.service.createDraft({ ...body, replyToId: c.id }), this.saving, this.formError, draft => {
      this.panel.set(null);
      this.toast.success('حُفظت مسودة الرد');
      void this.router.navigate(['/diwan', draft.id]);
    });
  }

  refer(body: ReferInput) {
    trackRequest(this.service.refer(this.item()!.id, body), this.saving, this.formError, this.done('أُحيلت المعاملة'));
  }

  acknowledge() {
    trackRequest(this.service.acknowledge(this.item()!.id), this.saving, this.error, this.done('سُجّل الاستلام'));
  }

  changeStatus() {
    if (!this.statusChoice) return;
    const c = this.item()!;
    trackRequest(this.service.setStatus(c.id, this.statusChoice, c.rowVersion), this.saving, this.formError, this.done('تغيّرت الحالة'));
  }

  submit() { trackRequest(this.service.submit(this.item()!.id), this.saving, this.error, this.done('رُفعت المسودة للاعتماد')); }

  decide(approve: boolean) {
    const c = this.item()!;
    if (!approve && !this.note.trim()) { this.formError.set('اكتب سبب إعادة المسودة'); return; }
    trackRequest(this.service.decide(c.id, approve, this.note, c.rowVersion), this.saving, this.formError, this.done(approve ? 'اعتُمدت المسودة' : 'أُعيدت المسودة'));
  }

  issue() { trackRequest(this.service.issue(this.item()!.id), this.saving, this.error, this.done('صدر الكتاب')); }

  attachmentsChanged(c: Correspondence) { this.item.set(c); }

  print() { void this.router.navigate(['/diwan/print', this.item()!.id]); }

  /** هذا الكتاب صادر بعد اعتماده: له ورقة طباعة */
  canPrint = computed(() => { const c = this.item(); return !!c && c.direction === OUTGOING && (c.outgoingState === OUTGOING_STATES.approved || c.outgoingState === OUTGOING_STATES.issued); });
  isDraft = computed(() => this.item()?.direction === OUTGOING && this.item()?.outgoingState === OUTGOING_STATES.draft);
  editMode = (): RegisterMode => 'edit';

  actionAr(action: string) { return ACTION_AR[action] ?? action; }
  stateClass(c: Correspondence) { return c.isClosed ? 'pill muted' : c.isOverdue ? 'pill pill-late' : 'pill'; }
  stateLabel(c: Correspondence) { return c.direction === INCOMING ? c.statusName ?? '—' : c.outgoingStateAr ?? '—'; }
}
