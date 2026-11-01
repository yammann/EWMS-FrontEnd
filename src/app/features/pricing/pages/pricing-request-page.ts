import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ComparisonRow, PRICING_DECISION, PRICING_STATUS, PricingAssignee, PricingOffer, PricingOfferInput, PricingRequest, PricingRequestInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { OfferFormDialog } from '../components/offer-form-dialog';
import { RequestFormDialog } from '../components/request-form-dialog';

type Tab = 'main' | 'tasks';
type Dialog =
  | { kind: 'edit' } | { kind: 'assign' } | { kind: 'cancel' } | { kind: 'offer'; offer: PricingOffer | null }
  | { kind: 'select'; row: ComparisonRow; item: string } | { kind: 'recommend' } | { kind: 'decide' } | { kind: 'send' };

/**
 * صفحة طلب التسعير: البنود ← عروض الموردين ← مقارنة بند بند (وحدة وعملة واحدة فقط) ← اختيار سطر بسبب مكتوب ← توصية ← اعتماد لغير من أوصى ← إرسال النتيجة.
 * «الأرخص» معلومة تُعرض ولا تُختار آلياً؛ والأزرار كلها تتبع أعلام الخادم. المبالغ لا تُجمع عبر عملات (إجمالي كل عملة على حدة).
 */
@Component({
  selector: 'app-pricing-request-page', standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, LinkedTasks, OfferFormDialog, RequestFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-request-page.scss'],
  templateUrl: './pricing-request-page.html'
})
export class PricingRequestPage {
  private service = inject(PricingService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  ps = PRICING_STATUS;
  decisions = PRICING_DECISION;

  request = signal<PricingRequest | null>(null);
  loading = signal(false);
  error = signal('');
  assignees = signal<PricingAssignee[]>([]);

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs: { key: Tab; label: string }[] = [{ key: 'main', label: 'البنود والمقارنة' }, { key: 'tasks', label: 'المهام' }];
  tab = computed<Tab>(() => this.tabs.find(t => t.key === this.tabParam())?.key ?? 'main');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');

  note = ''; reason = ''; assigneeId: number | null = null; decision: number = PRICING_DECISION.approve; recipient = '';

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.request()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.get(id), this.loading, this.error, r => this.request.set(r));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'main' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  private done(message: string) {
    return (r: PricingRequest) => { this.request.set(r); this.dialog.set(null); this.toast.success(message); };
  }

  open(dialog: Dialog) {
    this.formError.set(''); this.note = ''; this.reason = ''; this.recipient = '';
    if (dialog.kind === 'assign') {
      const r = this.request()!;
      this.assigneeId = r.assigneeUserId;
      this.service.assignees(r.branchId).subscribe({ next: list => this.assignees.set(list), error: e => this.formError.set(e.message) });
    }
    if (dialog.kind === 'decide') this.decision = PRICING_DECISION.approve;
    this.dialog.set(dialog);
  }

  // ─────────── الطلب ───────────
  saveRequest(v: PricingRequestInput) { const r = this.request()!; trackRequest(this.service.update(r.id, v), this.saving, this.formError, this.done('حُفظ الطلب')); }

  assign() {
    const r = this.request()!;
    if (!this.assigneeId) { this.formError.set('اختر الموظف'); return; }
    trackRequest(this.service.assign(r.id, this.assigneeId, r.rowVersion), this.saving, this.formError, this.done('كُلِّف الموظف بالطلب'));
  }

  cancel() { const r = this.request()!; trackRequest(this.service.cancel(r.id, this.note, r.rowVersion), this.saving, this.formError, this.done('أُلغي الطلب')); }

  // ─────────── العروض والاختيار ───────────
  saveOffer(v: PricingOfferInput) {
    const r = this.request()!, d = this.dialog();
    if (d?.kind !== 'offer') return;
    trackRequest(d.offer ? this.service.updateOffer(d.offer.id, v) : this.service.addOffer(r.id, v), this.saving, this.formError, this.done(d.offer ? 'حُفظ العرض' : 'سُجّل العرض'));
  }

  confirmSelect() {
    const d = this.dialog();
    if (d?.kind !== 'select') return;
    if (!this.reason.trim()) { this.formError.set('اكتب سبب اختيار هذا العرض'); return; }
    trackRequest(this.service.select(d.row.lineId, this.reason), this.saving, this.formError, this.done('اختير السطر'));
  }

  unselect(row: ComparisonRow) {
    trackRequest(this.service.unselect(row.lineId), this.saving, this.error, this.done('أُلغي الاختيار'));
  }

  // ─────────── المسار ───────────
  recommend() {
    const r = this.request()!;
    if (!this.note.trim()) { this.formError.set('اكتب التوصية'); return; }
    trackRequest(this.service.recommend(r.id, this.note, r.rowVersion), this.saving, this.formError, this.done('وُثّقت التوصية وأُرسلت للاعتماد'));
  }

  decide() {
    const r = this.request()!;
    if (this.decision !== PRICING_DECISION.approve && !this.note.trim()) { this.formError.set('اكتب سبب الرفض أو الإعادة'); return; }
    const message = this.decision === PRICING_DECISION.approve ? 'اعتُمدت النتيجة' : this.decision === PRICING_DECISION.reject ? 'رُفضت النتيجة' : 'أُعيد الطلب لجمع العروض';
    trackRequest(this.service.decide(r.id, this.decision, this.note, r.rowVersion), this.saving, this.formError, this.done(message));
  }

  sendResult() {
    const r = this.request()!;
    if (!this.recipient.trim()) { this.formError.set('اكتب الجهة المستلمة'); return; }
    trackRequest(this.service.sendResult(r.id, this.recipient, this.note, r.rowVersion), this.saving, this.formError, this.done('سُجّل إرسال النتيجة'));
  }

  conformityClass(row: ComparisonRow) { return row.conformity === 2 ? 'pill ok' : row.conformity === 3 ? 'pill warn' : 'pill'; }
}
