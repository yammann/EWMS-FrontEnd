import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { ProjectsService, type ProjectMember } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ContractFormDialog } from '../components/contract-form-dialog';
import {
  CONTRACT_STATUS, CONTRACT_STATUSES, Committee, Contract, ContractInput, ContractOffer, EVALUATION_STATUS, Evaluation, EvaluationCriterion, RETENTION_DECISION,
  RETENTION_STATE, RetentionEntry
} from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';

type Tab = 'info' | 'offers' | 'amendments' | 'committee' | 'retention' | 'evaluations' | 'tasks';
type Dialog =
  | { kind: 'edit' } | { kind: 'status'; to: number } | { kind: 'offer' } | { kind: 'award'; o: ContractOffer } | { kind: 'amendment' }
  | { kind: 'committee'; c: Committee | null } | { kind: 'retention' } | { kind: 'decide'; r: RetentionEntry }
  | { kind: 'evaluation'; e: Evaluation | null } | { kind: 'evalReview'; e: Evaluation } | { kind: 'evalReturn'; e: Evaluation };

interface MemberRow { userId: number | null; externalName: string; capacity: string; isChair: boolean; }
interface ScoreRow { criterionId: number; name: string; weight: number | null; score: number | null; note: string; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * صفحة العقد: بياناته وحالته (قرار يدوي)، العروض والإرساء، الملاحق المعتمدة، اللجنة الفنية والمالية، المبالغ المحتجزة (أرقام يدوية وقرار إفراج
 * نهائي موثّق) والضمان، وتقييم المقاول (درجات يدوية بلا تصنيف؛ من أعدّ لا يراجع). الأزرار كلها تتبع أعلام الخادم.
 */
@Component({
  selector: 'app-contract-page', standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, LinkedTasks, ContractFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './contract-page.scss'],
  templateUrl: './contract-page.html'
})
export class ContractPage {
  private service = inject(ContractsService);
  private projects = inject(ProjectsService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  cs = CONTRACT_STATUS;
  statusList = CONTRACT_STATUSES;
  rs = RETENTION_STATE;
  rd = RETENTION_DECISION;
  es = EVALUATION_STATUS;

  contract = signal<Contract | null>(null);
  loading = signal(false);
  error = signal('');
  members = signal<ProjectMember[]>([]);
  criteria = signal<EvaluationCriterion[]>([]);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs = computed<{ key: Tab; label: string }[]>(() => {
    const c = this.contract();
    const list: { key: Tab; label: string }[] = [{ key: 'info', label: 'البيانات' }];
    if (c && c.method !== 1) list.push({ key: 'offers', label: `العروض (${c.offers.length})` });
    list.push({ key: 'amendments', label: `الملاحق (${c?.amendments.length ?? 0})` }, { key: 'committee', label: 'اللجنة' },
      { key: 'retention', label: 'المحتجز والضمان' }, { key: 'evaluations', label: `تقييم المقاول (${c?.evaluations.length ?? 0})` }, { key: 'tasks', label: 'المهام' });
    return list;
  });
  tab = computed<Tab>(() => this.tabs().find(t => t.key === this.tabParam())?.key ?? 'info');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');

  // حقول النوافذ
  note = ''; title = ''; description = ''; amount: number | null = null; date = today(); valueChange: number | null = null; durationChange: number | null = null;
  contractorId: number | null = null; authority = ''; decision: number = RETENTION_DECISION.continue;
  formedAt = today(); decisionNumber = ''; recommendations = ''; memberRows: MemberRow[] = [];
  evaluationDate = today(); evaluationNotes = ''; scoreRows: ScoreRow[] = [];
  contractors = signal<{ id: number; name: string; isActive: boolean }[]>([]);

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.contract()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, c => this.contract.set(c));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'info' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  statusAr(value: number) { return this.statusList.find(s => s.value === value)?.label ?? ''; }

  private done(message: string) {
    return (c: Contract) => { this.contract.set(c); this.dialog.set(null); this.toast.success(message); };
  }

  // ─────────── النوافذ ───────────
  open(dialog: Dialog) {
    const c = this.contract()!;
    this.formError.set(''); this.note = ''; this.title = ''; this.description = ''; this.amount = null; this.date = today(); this.valueChange = null; this.durationChange = null;
    this.contractorId = null; this.authority = ''; this.decision = RETENTION_DECISION.continue;
    if (dialog.kind === 'committee' || dialog.kind === 'evaluation') this.loadMembers();
    if (dialog.kind === 'committee') {
      const k = dialog.c;
      this.formedAt = k ? day(k.formedAt) : today(); this.decisionNumber = k?.decisionNumber ?? ''; this.recommendations = k?.recommendations ?? '';
      this.memberRows = k ? k.members.map(m => ({ userId: m.userId, externalName: m.isExternal ? m.name : '', capacity: m.capacity, isChair: m.isChair }))
        : [{ userId: null, externalName: '', capacity: 'رئيس قسم الإشراف', isChair: true }];
    }
    if (dialog.kind === 'evaluation') {
      const e = dialog.e;
      this.evaluationDate = e ? day(e.evaluationDate) : today(); this.evaluationNotes = e?.notes ?? '';
      this.service.criteria(c.branchId, false).subscribe({
        next: list => {
          this.criteria.set(list);
          const existing = new Map((e?.scores ?? []).map(s => [s.criterionId, s]));
          this.scoreRows = list.map(k => ({ criterionId: k.id, name: k.name, weight: k.weight, score: existing.get(k.id)?.score ?? null, note: existing.get(k.id)?.note ?? '' }));
        },
        error: () => this.scoreRows = []
      });
    }
    if (dialog.kind === 'offer') this.service.contractors(c.branchId, false).subscribe({ next: l => this.contractors.set(l), error: () => this.contractors.set([]) });
    this.dialog.set(dialog);
  }

  private loadMembers() {
    const c = this.contract()!;
    if (!this.members().length) this.projects.get(c.projectId).subscribe({ next: p => this.members.set(p.members ?? []), error: () => this.members.set([]) });
  }

  // ─────────── العقد ───────────
  saveContract(body: ContractInput) { trackRequest(this.service.update(this.contract()!.id, body), this.saving, this.formError, this.done('حُفظت التعديلات')); }

  changeStatus() {
    const d = this.dialog(), c = this.contract()!;
    if (d?.kind !== 'status') return;
    if ((d.to === CONTRACT_STATUS.terminated || d.to === CONTRACT_STATUS.cancelled) && !this.note.trim()) { this.formError.set('اكتب سبب الفسخ أو الإلغاء'); return; }
    trackRequest(this.service.changeStatus(c.id, d.to, this.note, c.rowVersion), this.saving, this.formError, this.done(`صار العقد «${this.statusAr(d.to)}»`));
  }

  // ─────────── العروض ───────────
  addOffer() {
    if (!this.contractorId || this.amount === null) { this.formError.set('اختر المقاول وأدخل مبلغ العرض'); return; }
    trackRequest(this.service.addOffer(this.contract()!.id, { contractorId: this.contractorId, amount: this.amount, receivedAt: this.date, note: this.note.trim() || null }),
      this.saving, this.formError, this.done('سُجّل العرض'));
  }

  award() {
    const d = this.dialog(), c = this.contract()!;
    if (d?.kind !== 'award') return;
    trackRequest(this.service.award(d.o.id, this.date || null, this.note, c.rowVersion), this.saving, this.formError, this.done('رسا التعاقد على العرض'));
  }

  // ─────────── الملاحق ───────────
  addAmendment() {
    if (!this.title.trim()) { this.formError.set('اكتب عنوان الملحق'); return; }
    trackRequest(this.service.addAmendment(this.contract()!.id, {
      title: this.title.trim(), description: this.description.trim() || null, valueChange: this.valueChange, durationChangeDays: this.durationChange,
      approvedAt: this.date, documentVersionId: null
    }), this.saving, this.formError, this.done('سُجّل الملحق'));
  }

  // ─────────── اللجنة ───────────
  addMember() { this.memberRows = [...this.memberRows, { userId: null, externalName: '', capacity: '', isChair: false }]; }
  removeMember(i: number) { this.memberRows = this.memberRows.filter((_, k) => k !== i); }
  setChair(i: number) { this.memberRows = this.memberRows.map((m, k) => ({ ...m, isChair: k === i })); }

  saveCommittee() {
    const d = this.dialog(), c = this.contract()!;
    if (d?.kind !== 'committee') return;
    const body = {
      formedAt: this.formedAt, decisionNumber: this.decisionNumber.trim() || null, decisionVersionId: null, recommendations: this.recommendations.trim() || null,
      members: this.memberRows.map(m => ({ userId: m.userId, externalName: m.userId ? null : m.externalName.trim() || null, capacity: m.capacity.trim(), isChair: m.isChair })),
      rowVersion: d.c?.rowVersion ?? null
    };
    trackRequest(d.c ? this.service.updateCommittee(d.c.id, body) : this.service.createCommittee(c.id, body), this.saving, this.formError, this.done(d.c ? 'حُفظت اللجنة' : 'شُكّلت اللجنة'));
  }

  // ─────────── المحتجز ───────────
  addRetention() {
    if (this.amount === null || this.amount <= 0) { this.formError.set('أدخل مبلغاً أكبر من صفر'); return; }
    trackRequest(this.service.addRetention(this.contract()!.id, { amount: this.amount, withheldAt: this.date, note: this.note.trim() || null }),
      this.saving, this.formError, this.done('سُجّل المبلغ المحتجز'));
  }

  decideRetention() {
    const d = this.dialog();
    if (d?.kind !== 'decide') return;
    if (!this.authority.trim()) { this.formError.set('اكتب الجهة التي اعتمدت القرار'); return; }
    trackRequest(this.service.decideRetention(d.r.id, {
      decision: this.decision, decidedAt: this.date, approvingAuthority: this.authority.trim(), note: this.note.trim() || null, documentVersionId: null
    }), this.saving, this.formError, this.done(this.decision === RETENTION_DECISION.release ? 'سُجّل الإفراج (نهائي)' : 'سُجّل استمرار الاحتجاز'));
  }

  // ─────────── التقييم ───────────
  saveEvaluation() {
    const d = this.dialog(), c = this.contract()!;
    if (d?.kind !== 'evaluation') return;
    const body = {
      evaluationDate: this.evaluationDate, notes: this.evaluationNotes.trim() || null, documentVersionId: d.e?.documentVersionId ?? null,
      scores: this.scoreRows.filter(s => s.score !== null || s.note.trim()).map(s => ({ criterionId: s.criterionId, score: s.score, note: s.note.trim() || null })),
      rowVersion: d.e?.rowVersion ?? null
    };
    trackRequest(d.e ? this.service.updateEvaluation(d.e.id, body) : this.service.createEvaluation(c.id, body), this.saving, this.formError, this.done('حُفظت المسودة'));
  }

  submitEvaluation(e: Evaluation) { trackRequest(this.service.submitEvaluation(e.id, e.rowVersion), this.saving, this.error, this.done('أُرسل التقييم إلى مكتب العقود')); }

  deleteEvaluation(e: Evaluation) { trackRequest(this.service.deleteEvaluation(e.id), this.saving, this.error, this.done('حُذفت المسودة')); }

  reviewEvaluation() {
    const d = this.dialog();
    if (d?.kind !== 'evalReview') return;
    trackRequest(this.service.reviewEvaluation(d.e.id, this.note, d.e.rowVersion), this.saving, this.formError, this.done('حُفظ التقييم في ملف المقاول'));
  }

  returnEvaluation() {
    const d = this.dialog();
    if (d?.kind !== 'evalReturn') return;
    if (!this.note.trim()) { this.formError.set('اكتب سبب إعادة التقييم'); return; }
    trackRequest(this.service.returnEvaluation(d.e.id, this.note, d.e.rowVersion), this.saving, this.formError, this.done('أُعيد التقييم لمُعدّه'));
  }

  // ─────────── العرض ───────────
  retentionClass(r: RetentionEntry) { return r.state === RETENTION_STATE.released ? 'pill ok' : r.state === RETENTION_STATE.continued ? 'pill warn' : 'pill'; }
  evaluationClass(e: Evaluation) { return e.status === EVALUATION_STATUS.reviewed ? 'pill ok' : e.status === EVALUATION_STATUS.submitted ? 'pill info' : 'pill'; }
}
