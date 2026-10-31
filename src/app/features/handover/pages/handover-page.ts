import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { ProjectsService, type ProjectMember } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { HANDOVER_RESULT, HANDOVER_STATUS, Handover, HandoverNote, NOTE_STATUS } from '../data-access/handover.models';
import { HandoverService } from '../data-access/handover.service';

type Tab = 'main' | 'tasks';
type Dialog =
  | { kind: 'committee' } | { kind: 'conclude' } | { kind: 'cancel' } | { kind: 'note'; n: HandoverNote | null }
  | { kind: 'fix'; n: HandoverNote } | { kind: 'verify'; n: HandoverNote } | { kind: 'reject'; n: HandoverNote };

interface MemberRow { userId: number | null; externalName: string; capacity: string; isChair: boolean; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * صفحة محضر الاستلام: الطلب ← لجنة الاستلام ← الكشف والنتيجة («بلا ملاحظات» أو «بملاحظات») ← ملاحظات اللجنة تُتابَع حتى تُغلق
 * (معالجة ثم تحقق بغير من عالج). الأزرار كلها تتبع أعلام الخادم؛ والنظام ينبّه ولا يقرر (لا يُغلق المشروع آلياً).
 */
@Component({
  selector: 'app-handover-page', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, LinkedTasks],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './handover-page.scss'],
  templateUrl: './handover-page.html'
})
export class HandoverPage {
  private service = inject(HandoverService);
  private projects = inject(ProjectsService);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  hs = HANDOVER_STATUS;
  hr = HANDOVER_RESULT;
  ns = NOTE_STATUS;

  handover = signal<Handover | null>(null);
  loading = signal(false);
  error = signal('');
  members = signal<ProjectMember[]>([]);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs: { key: Tab; label: string }[] = [{ key: 'main', label: 'اللجنة والملاحظات' }, { key: 'tasks', label: 'المهام' }];
  tab = computed<Tab>(() => this.tabs.find(t => t.key === this.tabParam())?.key ?? 'main');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');

  note = ''; formedAt = today(); decisionNumber = ''; recommendations = ''; memberRows: MemberRow[] = [];
  result: number = HANDOVER_RESULT.withoutNotes; inspectionDate = today();
  noteText = ''; responsibleUserId: number | null = null; responsibleName = ''; dueDate = '';

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.handover()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, h => this.handover.set(h));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'main' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  private done(message: string) {
    return (h: Handover) => { this.handover.set(h); this.dialog.set(null); this.toast.success(message); };
  }

  // ─────────── النوافذ ───────────
  open(dialog: Dialog) {
    const h = this.handover()!;
    this.formError.set(''); this.note = '';
    if (dialog.kind === 'committee' || dialog.kind === 'note') this.loadMembers();
    if (dialog.kind === 'committee') {
      const k = h.committee;
      this.formedAt = k ? day(k.formedAt) : today(); this.decisionNumber = k?.decisionNumber ?? ''; this.recommendations = k?.recommendations ?? '';
      this.memberRows = k ? k.members.map(m => ({ userId: m.userId, externalName: m.isExternal ? m.name : '', capacity: m.capacity, isChair: m.isChair }))
        : [{ userId: null, externalName: '', capacity: 'رئيس اللجنة', isChair: true }];
    }
    if (dialog.kind === 'conclude') {
      this.result = h.notes.length ? HANDOVER_RESULT.withNotes : HANDOVER_RESULT.withoutNotes; this.inspectionDate = day(h.inspectionDate) || today();
    }
    if (dialog.kind === 'note') {
      const n = dialog.n;
      this.noteText = n?.description ?? ''; this.responsibleUserId = n?.responsibleUserId ?? null;
      this.responsibleName = n && !n.responsibleUserId ? n.responsibleName ?? '' : ''; this.dueDate = day(n?.dueDate);
    }
    this.dialog.set(dialog);
  }

  private loadMembers() {
    const h = this.handover()!;
    if (!this.members().length) this.projects.get(h.projectId).subscribe({ next: p => this.members.set(p.members ?? []), error: () => this.members.set([]) });
  }

  // ─────────── اللجنة والنتيجة ───────────
  addMember() { this.memberRows = [...this.memberRows, { userId: null, externalName: '', capacity: '', isChair: false }]; }
  removeMember(i: number) { this.memberRows = this.memberRows.filter((_, k) => k !== i); }
  setChair(i: number) { this.memberRows = this.memberRows.map((m, k) => ({ ...m, isChair: k === i })); }

  saveCommittee() {
    const h = this.handover()!;
    const k = h.committee;
    const body = {
      formedAt: this.formedAt, decisionNumber: this.decisionNumber.trim() || null, decisionVersionId: null, recommendations: this.recommendations.trim() || null,
      members: this.memberRows.map(m => ({ userId: m.userId, externalName: m.userId ? null : m.externalName.trim() || null, capacity: m.capacity.trim(), isChair: m.isChair })),
      // التشكيل بنسخة المحضر، والتعديل بنسخة اللجنة
      rowVersion: k ? k.rowVersion : h.rowVersion
    };
    trackRequest(k ? this.service.updateCommittee(h.id, body) : this.service.formCommittee(h.id, body), this.saving, this.formError, this.done(k ? 'حُفظت اللجنة' : 'شُكّلت لجنة الاستلام'));
  }

  conclude() {
    const h = this.handover()!;
    trackRequest(this.service.conclude(h.id, {
      result: this.result, inspectionDate: this.inspectionDate, resultNote: this.note.trim() || null, minutesVersionId: null, supervisionReportVersionId: null, rowVersion: h.rowVersion
    }), this.saving, this.formError, this.done('سُجّلت النتيجة'));
  }

  cancel() { const h = this.handover()!; trackRequest(this.service.cancel(h.id, this.note, h.rowVersion), this.saving, this.formError, this.done('أُلغي الطلب')); }

  // ─────────── الملاحظات ───────────
  saveNote() {
    const h = this.handover()!, d = this.dialog();
    if (d?.kind !== 'note') return;
    if (!this.noteText.trim()) { this.formError.set('اكتب وصف الملاحظة'); return; }
    const body = {
      description: this.noteText.trim(), responsibleUserId: this.responsibleUserId, responsibleName: this.responsibleUserId ? null : this.responsibleName.trim() || null,
      dueDate: this.dueDate || null, rowVersion: d.n?.rowVersion ?? null
    };
    trackRequest(d.n ? this.service.updateNote(d.n.id, body) : this.service.addNote(h.id, body), this.saving, this.formError, this.done(d.n ? 'حُفظت الملاحظة' : 'سُجّلت الملاحظة'));
  }

  async removeNote(n: HandoverNote) {
    if (!(await this.confirm.ask('حذف هذه الملاحظة؟', 'حذف'))) return;
    trackRequest(this.service.removeNote(n.id), this.saving, this.error, this.done('حُذفت الملاحظة'));
  }

  fix() {
    const d = this.dialog();
    if (d?.kind !== 'fix') return;
    if (!this.note.trim()) { this.formError.set('اكتب ما عولج'); return; }
    trackRequest(this.service.fix(d.n.id, this.note, d.n.rowVersion), this.saving, this.formError, this.done('سُجّلت المعالجة وتنتظر التحقق'));
  }

  verify() {
    const d = this.dialog();
    if (d?.kind !== 'verify') return;
    trackRequest(this.service.verify(d.n.id, this.note, d.n.rowVersion), this.saving, this.formError, this.done('أُغلقت الملاحظة'));
  }

  reject() {
    const d = this.dialog();
    if (d?.kind !== 'reject') return;
    if (!this.note.trim()) { this.formError.set('اكتب سبب رفض المعالجة'); return; }
    trackRequest(this.service.reject(d.n.id, this.note, d.n.rowVersion), this.saving, this.formError, this.done('أُعيدت الملاحظة مفتوحة'));
  }

  noteClass(n: HandoverNote) { return n.status === NOTE_STATUS.verified ? 'pill ok' : n.status === NOTE_STATUS.fixed ? 'pill info' : n.isOverdue ? 'pill warn' : 'pill'; }
}
