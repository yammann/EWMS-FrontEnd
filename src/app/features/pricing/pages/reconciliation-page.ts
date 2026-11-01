import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { AUDIT_RESULTS, RECONCILIATION_STATUS, Reconciliation, ReconciliationInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { ReconciliationFormDialog } from '../components/reconciliation-form-dialog';

type Dialog = 'edit' | 'record' | 'approve' | 'return' | 'refer' | 'cancel';

/**
 * صفحة المطابقة: المستند وبنوده بمراجعها المجمَّدة والفروق (سعر وكمية) التي يحسبها الخادم، ثم نتيجة المدقق (إحدى ست) بملاحظاته،
 * ثم اعتماد غيره أو إعادته، ثم الإحالة إلى الجهة المختصة. «النتيجة المقترحة» معلومة لا قرار. الأزرار كلها تتبع أعلام الخادم.
 */
@Component({
  selector: 'app-reconciliation-page', standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, ReconciliationFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-request-page.scss'],
  styles: [`.diff-up { color: var(--danger, #c0392b); font-weight: 700; } .diff-down { color: #0a5bb5; font-weight: 700; }`],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          @if (rec(); as r) {
            <span class="eyebrow">مطابقة مستند@if (r.projectId) { · <a [routerLink]="['/projects', r.projectId]">{{ r.projectName }}</a> }</span>
          } @else { <span class="eyebrow">مطابقة مستند</span> }
          <h1>{{ rec()?.number || (loading() ? 'جارٍ التحميل…' : 'مطابقة') }}</h1>
          @if (rec(); as r) {
            <p class="muted"><strong>{{ r.documentKindAr }} <span dir="ltr">{{ r.documentNumber }}</span></strong> · {{ r.supplierName }} · <span class="pill">{{ r.statusAr }}</span>
              @if (r.contractId) { · <a [routerLink]="['/contracts', r.contractId]" dir="ltr">{{ r.contractNumber }}</a> }</p>
          }
        </div>
        <div class="header-actions">
          @if (rec(); as r) {
            @if (r.canRecord) { <button class="btn" type="button" (click)="open('record')">تسجيل نتيجة التدقيق</button> }
            @if (r.canDecide) {
              <button class="btn" type="button" (click)="open('approve')">اعتماد</button>
              <button class="btn btn-ghost" type="button" (click)="open('return')">إعادة للتصحيح</button>
            }
            @if (r.canRefer) { <button class="btn" type="button" (click)="open('refer')">إحالة إلى الجهة المختصة</button> }
            @if (r.canEdit) { <button class="btn btn-ghost" type="button" (click)="open('edit')">تعديل</button> }
            @if (r.canCancel) { <button class="btn btn-ghost" type="button" (click)="open('cancel')">إلغاء</button> }
          }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (rec(); as r) {
        @if (r.status === st.draft) { <p class="notice" role="status">مسودة: اربط البنود بمراجعها ثم سجّل نتيجة التدقيق. المقارنة تقترح «{{ r.suggestedResultAr }}» — معلومة لا قرار.</p> }
        @else if (r.status === st.returned) { <p class="notice warn" role="status">أُعيدت للتصحيح: {{ r.decisionNote }}</p> }
        @else if (r.status === st.cancelled) { <p class="notice" role="status">مطابقة ملغاة: للقراءة.</p> }
        @else if (r.status < st.approved) { <p class="notice" role="status">سُجّلت النتيجة «{{ r.statusAr }}» وتنتظر الاعتماد من غير من دقّقها.</p> }

            <section class="panel">
              <div class="panel-heading"><h2>بيانات المستند</h2></div>
              <dl class="facts">
                <div><dt>تاريخ المستند</dt><dd>{{ r.documentDate | utc | date:'yyyy/MM/dd' }}</dd></div>
                <div><dt>الإجمالي</dt><dd>{{ r.total | number:'1.0-2' }} {{ r.currency }}</dd></div>
                <div><dt>دقّقه</dt><dd>{{ r.preparedByName }}@if (r.auditedAt) { <small>سجّل النتيجة {{ r.auditedAt | utc | date:'yyyy/MM/dd' }}</small> }</dd></div>
                <div><dt>النتيجة المسجَّلة</dt><dd>{{ r.auditResultAr || '—' }}</dd></div>
                <div><dt>النتيجة المقترحة (معلومة)</dt><dd>{{ r.suggestedResultAr }}</dd></div>
                @if (r.decidedByName) { <div><dt>قرّر</dt><dd>{{ r.decidedByName }} · {{ r.decidedAt | utc | date:'yyyy/MM/dd' }}</dd></div> }
                @if (r.referredTo) { <div><dt>أُحيلت إلى</dt><dd>{{ r.referredTo }}<small>{{ r.referredByName }} · {{ r.referredAt | utc | date:'yyyy/MM/dd' }}</small></dd></div> }
              </dl>
              @if (r.auditNote) { <p class="pre"><strong>ملاحظات المدقق:</strong> {{ r.auditNote }}</p> }
              @if (r.decisionNote && r.status !== st.returned) { <p class="pre"><strong>ملاحظة القرار:</strong> {{ r.decisionNote }}</p> }
              @if (r.referralNote) { <p class="pre"><strong>ملاحظة الإحالة:</strong> {{ r.referralNote }}</p> }
              @if (r.notes) { <p class="pre"><strong>ملاحظات:</strong> {{ r.notes }}</p> }
            </section>

            <section class="panel">
              <div class="panel-heading"><h2>المقارنة بنداً بنداً <span class="count">({{ r.lines.length }})</span></h2></div>
              <p class="muted">الفرق = ما في المستند − المرجع (موجب: أغلى أو أكثر من المرجع). تُقارَن الوحدة والعملة نفسهما فقط؛ وبلا مرجع أو بوحدة أو عملة مختلفة يظهر «غير قابل للمقارنة». المرجع مجمَّد كما كان عند الربط.</p>
              @if (!r.lines.length) { <app-empty-state>لا بنود</app-empty-state> }
              @else {
                <div class="table-wrap"><table>
                  <thead><tr><th>#</th><th>البند</th><th>في المستند</th><th>المرجع</th><th>فرق السعر</th><th>فرق الكمية</th><th>الحالة</th></tr></thead>
                  <tbody>
                    @for (l of r.lines; track l.id) {
                      <tr [class.selected]="l.hasDifference">
                        <td>{{ $index + 1 }}</td>
                        <td>{{ l.description }}@if (l.note) { <small>{{ l.note }}</small> }</td>
                        <td>{{ l.quantity | number:'1.0-3' }} {{ l.unit }} × {{ l.unitPrice | number:'1.0-4' }} {{ r.currency }}<small>{{ l.total | number:'1.0-2' }}</small></td>
                        <td>@if (l.hasReference) { {{ l.referenceUnitPrice | number:'1.0-4' }} {{ l.referenceCurrency }} / {{ l.referenceUnit }}@if (l.referenceQuantity !== null) { <small>الكمية: {{ l.referenceQuantity | number:'1.0-3' }}</small> }<small>{{ l.referenceLabel }}</small> } @else { — }</td>
                        <td [class]="diffClass(l.priceDifference)">{{ l.comparable ? (l.priceDifference | number:'1.0-4') : '—' }}</td>
                        <td [class]="diffClass(l.quantityDifference)">{{ l.comparable && l.quantityDifference !== null ? (l.quantityDifference | number:'1.0-3') : '—' }}</td>
                        <td>@if (!l.comparable) { <span class="pill warn">غير قابل للمقارنة</span><small>{{ l.notComparableReason }}</small> } @else if (l.hasDifference) { <span class="pill warn">فرق</span> } @else { <span class="pill ok">مطابق</span> }</td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              }
            </section>
      } @else if (loading()) {
        <app-empty-state>جارٍ التحميل…</app-empty-state>
      }
    </div>

    @if (dialog(); as d) {
      @switch (d) {
        @case ('edit') { <app-reconciliation-form-dialog [reconciliation]="rec()" [busy]="saving()" [error]="formError()" (submitted)="save($event)" (closed)="dialog.set(null)" /> }

        @case ('record') {
          <app-modal heading="تسجيل نتيجة التدقيق" [subheading]="rec()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack">
              <app-alert [message]="formError()" />
              <p class="muted">المقارنة تقترح: <strong>{{ rec()!.suggestedResultAr }}</strong> (معلومة؛ القرار لك). «مطابق» لا يُسجَّل والمقارنة تخالفه، وغيره يشترط ملاحظة.</p>
              <label class="form-field"><span class="form-label">النتيجة</span>
                <select name="res" [(ngModel)]="result">@for (s of results; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }</select></label>
              <label class="form-field"><span class="form-label">ملاحظات المدقق <small class="hint">({{ result === st.match ? 'اختياري' : 'مطلوب' }})</small></span><textarea name="n" [(ngModel)]="note" rows="4" maxlength="2000"></textarea></label>
            </div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="record()" [disabled]="saving()">تسجيل وإرسال للاعتماد</button></footer>
          </app-modal>
        }

        @case ('approve') {
          <app-modal heading="اعتماد المطابقة" [subheading]="rec()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" />
              <p class="muted">نتيجة المدقق: <strong>{{ rec()!.auditResultAr }}</strong>@if (rec()!.auditNote) { — {{ rec()!.auditNote }} }</p>
              <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="decide(true)" [disabled]="saving()">اعتماد بعد التدقيق</button></footer>
          </app-modal>
        }

        @case ('return') {
          <app-modal heading="إعادة المطابقة للتصحيح" [subheading]="rec()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" />
              <label class="form-field"><span class="form-label">ما المطلوب تصحيحه</span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="decide(false)" [disabled]="saving()">إعادة</button></footer>
          </app-modal>
        }

        @case ('refer') {
          <app-modal heading="إحالة المطابقة المعتمدة" [subheading]="rec()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" />
              <label class="form-field"><span class="form-label">الجهة المختصة</span><input name="rc" [(ngModel)]="recipient" maxlength="200" autocomplete="off"></label>
              <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="2" maxlength="1000"></textarea></label>
              <small class="hint">تسجيل يدوي لإحالة تمت بالإجراء المعتمد؛ لا ربط إلكتروني بالجهة.</small></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="refer()" [disabled]="saving()">تسجيل الإحالة</button></footer>
          </app-modal>
        }

        @case ('cancel') {
          <app-modal heading="إلغاء المطابقة" [subheading]="rec()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" /><p class="muted">يبقى الأثر ولا تُحذف المطابقة.</p>
              <label class="form-field"><span class="form-label">السبب <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">رجوع</button><button type="button" (click)="cancel()" [disabled]="saving()">إلغاء المطابقة</button></footer>
          </app-modal>
        }
      }
    }`
})
export class ReconciliationPage {
  private service = inject(PricingService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  st = RECONCILIATION_STATUS;
  results = AUDIT_RESULTS;
  rec = signal<Reconciliation | null>(null);
  loading = signal(false);
  error = signal('');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');
  note = ''; recipient = ''; result: number = RECONCILIATION_STATUS.match;

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.rec()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.getReconciliation(id), this.loading, this.error, r => this.rec.set(r));
  }

  diffClass(value: number | null) { return !value ? '' : value > 0 ? 'diff-up' : 'diff-down'; }

  private done(message: string) {
    return (r: Reconciliation) => { this.rec.set(r); this.dialog.set(null); this.toast.success(message); };
  }

  open(dialog: Dialog) {
    this.formError.set(''); this.note = ''; this.recipient = '';
    // الاقتراح معلومة: يبدأ به الحوار ويغيّره المدقق
    if (dialog === 'record') { const s = this.rec()!.suggestedResult; this.result = AUDIT_RESULTS.some(x => x.value === s) ? s : RECONCILIATION_STATUS.needsReview; }
    this.dialog.set(dialog);
  }

  save(v: ReconciliationInput) { const r = this.rec()!; trackRequest(this.service.updateReconciliation(r.id, v), this.saving, this.formError, this.done('حُفظت المطابقة')); }

  record() {
    const r = this.rec()!;
    if (this.result !== RECONCILIATION_STATUS.match && !this.note.trim()) { this.formError.set('اكتب ملاحظات المدقق'); return; }
    trackRequest(this.service.recordReconciliation(r.id, this.result, this.note, r.rowVersion), this.saving, this.formError, this.done('سُجّلت النتيجة وأُرسلت للاعتماد'));
  }

  decide(approve: boolean) {
    const r = this.rec()!;
    if (!approve && !this.note.trim()) { this.formError.set('اكتب ما المطلوب تصحيحه'); return; }
    trackRequest(this.service.decideReconciliation(r.id, approve, this.note, r.rowVersion), this.saving, this.formError, this.done(approve ? 'اعتُمدت المطابقة' : 'أُعيدت المطابقة للتصحيح'));
  }

  refer() {
    const r = this.rec()!;
    if (!this.recipient.trim()) { this.formError.set('اكتب الجهة المختصة'); return; }
    trackRequest(this.service.referReconciliation(r.id, this.recipient, this.note, r.rowVersion), this.saving, this.formError, this.done('سُجّلت الإحالة'));
  }

  cancel() { const r = this.rec()!; trackRequest(this.service.cancelReconciliation(r.id, this.note, r.rowVersion), this.saving, this.formError, this.done('أُلغيت المطابقة')); }
}
