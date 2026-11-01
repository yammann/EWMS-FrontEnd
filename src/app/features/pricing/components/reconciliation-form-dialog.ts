import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import type { ContractorResponseDto, ProjectResponseDto } from '@core/api/api-types';
import { ContractsService } from '@features/contracts';
import { ProjectsService } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { COMMON_CURRENCIES, DOCUMENT_KINDS, REFERENCE_KIND, Reconciliation, ReconciliationCandidate, ReconciliationInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';

interface LineRow { description: string; unit: string; quantity: number | null; unitPrice: number | null; reference: string; note: string; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);
const CURRENCY = /^[A-Z]{3}$/;
/** مفتاح المرجع في القائمة: النوع:المعرّف (فارغ = بلا مرجع) */
const key = (kind: number, id: number) => `${kind}:${id}`;

/**
 * تسجيل فاتورة أو كشف وارد وتعديل مسودته: البنود بكمياتها وأسعارها كما في المستند، ولكل بند مرجع اختياري من قائمة يقترحها الخادم
 * (أسطر عروض مختارة من طلبات معتمدة وأسعار مرجعية معتمدة لهذا المورد). المرجع يُجمَّد عند الحفظ؛ والمقارنة وفروقها يحسبها الخادم.
 */
@Component({
  selector: 'app-reconciliation-form-dialog', standalone: true,
  imports: [FormsModule, DecimalPipe, Alert, Modal],
  styles: [`
    .line-row { display: grid; grid-template-columns: 1.5fr 80px 90px 120px 1.6fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
    @media (max-width: 760px) { .line-row { grid-template-columns: 1fr; } }
    .total { font-weight: 700; margin-top: 4px; }
  `],
  template: `
    <app-modal [heading]="reconciliation() ? 'تعديل المطابقة' : 'مستند وارد جديد للمطابقة'" [subheading]="reconciliation()?.number ?? ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="localError() || error()" />
          <div class="form-grid-3">
            <label class="form-field"><span class="form-label">النوع</span><select name="k" [(ngModel)]="kind">@for (k of kinds; track k.value) { <option [ngValue]="k.value">{{ k.label }}</option> }</select></label>
            <label class="form-field"><span class="form-label">رقم المستند</span><input name="n" [(ngModel)]="documentNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">تاريخ المستند</span><input name="d" type="date" [(ngModel)]="documentDate" [max]="todayValue"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المورد</span>
              <select name="s" [ngModel]="supplierId()" (ngModelChange)="pickSupplier($event)"><option [ngValue]="0">اختر المورد</option>@for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</select></label>
            <label class="form-field"><span class="form-label">العملة <small class="hint">(ثلاثة أحرف؛ عملة واحدة للمستند)</small></span>
              <input name="c" [(ngModel)]="currency" list="reconciliation-currencies" maxlength="3" dir="ltr" autocomplete="off" style="max-width: 120px; text-transform: uppercase">
              <datalist id="reconciliation-currencies">@for (c of currencies; track c) { <option [value]="c"></option> }</datalist></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المشروع <small class="hint">(اختياري)</small></span>
              <select name="p" [(ngModel)]="projectId"><option [ngValue]="null">بلا مشروع</option>@for (p of projectList(); track p.id) { <option [ngValue]="p.id">{{ p.number }} — {{ p.name }}</option> }</select></label>
            @if (canChooseBranch() && !projectId && !reconciliation()) {
              <label class="form-field"><span class="form-label">الفرع</span>
                <select name="b" [(ngModel)]="branchId" (ngModelChange)="reloadCandidates()"><option [ngValue]="null">فرعي</option>@for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }</select></label>
            }
          </div>

          <div class="form-field"><span class="form-label">البنود <small class="hint">(ما في المستند؛ المرجع اختياري وبلا مرجع يُقترح «بيانات غير مكتملة»)</small></span>
            @if (supplierId() && !candidates().length) { <p class="hint">لا مراجع معتمدة لهذا المورد: تظهر هنا أسطر العروض المختارة من طلبات معتمدة والأسعار المرجعية المعتمدة.</p> }
            @for (l of rows; track $index) {
              <div class="line-row">
                <input [name]="'d' + $index" [(ngModel)]="l.description" placeholder="وصف البند" maxlength="500">
                <input [name]="'u' + $index" [(ngModel)]="l.unit" placeholder="الوحدة" maxlength="30">
                <input [name]="'q' + $index" type="number" min="0" step="any" [(ngModel)]="l.quantity" placeholder="الكمية">
                <input [name]="'p' + $index" type="number" min="0" step="any" [(ngModel)]="l.unitPrice" placeholder="سعر الوحدة">
                <select [name]="'r' + $index" [(ngModel)]="l.reference" (ngModelChange)="fromReference(l)" aria-label="المرجع">
                  <option value="">بلا مرجع</option>
                  @for (c of candidates(); track c.kind + ':' + c.id) { <option [value]="keyOf(c)">{{ c.label }} — {{ c.description }} ({{ c.unitPrice | number:'1.0-4' }} {{ c.currency }}/{{ c.unit }})</option> }
                </select>
                <button type="button" class="btn btn-ghost btn-sm" (click)="removeRow($index)" [disabled]="rows.length < 2">حذف</button>
              </div>
            }
            <button type="button" class="btn btn-ghost btn-sm" (click)="addRow()">+ بند</button>
            <p class="total">إجمالي المستند: {{ total() | number:'1.0-2' }} {{ currency.toUpperCase() }}</p>
          </div>
          <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span><textarea name="no" [(ngModel)]="notes" rows="2" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button><button type="submit" [disabled]="busy()">{{ reconciliation() ? 'حفظ' : 'حفظ كمسودة' }}</button></footer>
      </form>
    </app-modal>`
})
export class ReconciliationFormDialog {
  private service = inject(PricingService);
  private contracts = inject(ContractsService);
  private projects = inject(ProjectsService);
  private lookups = inject(LookupsService);

  reconciliation = input<Reconciliation | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<ReconciliationInput>();
  closed = output<void>();

  kinds = DOCUMENT_KINDS;
  currencies = COMMON_CURRENCIES;
  todayValue = today();
  suppliers = signal<{ id: number; name: string }[]>([]);
  projectList = signal<ProjectResponseDto[]>([]);
  branches = signal<Branch[]>([]);
  candidates = signal<ReconciliationCandidate[]>([]);
  supplierId = signal(0);
  localError = signal('');
  canChooseBranch = computed(() => this.service.access().canChooseBranch);

  kind = 1; documentNumber = ''; documentDate = today(); currency = ''; notes = '';
  projectId: number | null = null; branchId: number | null = null;
  rows: LineRow[] = [{ description: '', unit: '', quantity: null, unitPrice: null, reference: '', note: '' }];

  total = () => this.rows.reduce((sum, l) => sum + (l.quantity ?? 0) * (l.unitPrice ?? 0), 0);
  keyOf = (c: ReconciliationCandidate) => key(c.kind, c.id);

  constructor() {
    effect(() => {
      const r = this.reconciliation();
      if (!r) return;
      this.kind = r.documentKind; this.documentNumber = r.documentNumber; this.documentDate = day(r.documentDate); this.currency = r.currency; this.notes = r.notes;
      this.projectId = r.projectId; this.supplierId.set(r.supplierId);
      this.rows = r.lines.map(l => ({
        description: l.description, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, note: l.note,
        reference: l.referenceKind === REFERENCE_KIND.offerLine && l.referenceOfferLineId ? key(2, l.referenceOfferLineId)
          : l.referenceKind === REFERENCE_KIND.referencePrice && l.referencePriceId ? key(3, l.referencePriceId) : ''
      }));
      this.reloadCandidates();
    });
    this.contracts.contractors(null).subscribe({
      next: (list: ContractorResponseDto[]) => this.suppliers.set(list.filter(c => c.isActive).map(c => ({ id: c.id, name: c.name }))),
      error: () => this.suppliers.set([])
    });
    this.projects.search({ search: '', branchId: null, departmentId: null, siteId: null, stage: null, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.projectList.set(page.items as ProjectResponseDto[]), error: () => this.projectList.set([]) });
    if (this.service.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  pickSupplier(id: number) { this.supplierId.set(id); this.rows.forEach(r => r.reference = ''); this.reloadCandidates(); }

  reloadCandidates() {
    const supplier = this.supplierId();
    if (!supplier) { this.candidates.set([]); return; }
    this.service.reconciliationCandidates(supplier, '', this.reconciliation()?.branchId ?? this.branchId)
      .subscribe({ next: list => this.candidates.set(list), error: () => this.candidates.set([]) });
  }

  /** اختيار مرجع يملأ وصف البند ووحدته إن كانا فارغين (السعر والكمية من المستند لا من المرجع) */
  fromReference(row: LineRow) {
    const c = this.candidates().find(x => this.keyOf(x) === row.reference);
    if (!c) return;
    if (!row.description.trim()) row.description = c.description;
    if (!row.unit.trim()) row.unit = c.unit;
    if (!this.currency.trim()) this.currency = c.currency;
  }

  addRow() { this.rows = [...this.rows, { description: '', unit: '', quantity: null, unitPrice: null, reference: '', note: '' }]; }
  removeRow(i: number) { this.rows = this.rows.filter((_, k) => k !== i); }

  submit() {
    this.localError.set('');
    const currency = this.currency.trim().toUpperCase();
    if (!this.documentNumber.trim()) { this.localError.set('اكتب رقم المستند'); return; }
    if (!this.supplierId()) { this.localError.set('اختر المورد'); return; }
    if (!CURRENCY.test(currency)) { this.localError.set('العملة رمز من ثلاثة أحرف لاتينية (مثل SYP)'); return; }
    const bad = this.rows.findIndex(r => !r.description.trim() || !r.unit.trim() || !r.quantity || r.quantity <= 0 || r.unitPrice === null || r.unitPrice < 0);
    if (bad >= 0) { this.localError.set(`البند ${bad + 1}: الوصف والوحدة وكمية أكبر من صفر وسعر غير سالب مطلوبة`); return; }
    const r = this.reconciliation();
    this.submitted.emit({
      branchId: this.projectId || r ? null : this.branchId, documentKind: this.kind, documentNumber: this.documentNumber.trim(), documentDate: this.documentDate, supplierId: this.supplierId(),
      projectId: this.projectId, contractId: this.projectId ? r?.contractId ?? null : null, currency, notes: this.notes.trim() || null, documentVersionId: r?.documentVersionId ?? null,
      lines: this.rows.map(l => {
        const [k, id] = l.reference ? l.reference.split(':').map(Number) : [REFERENCE_KIND.none, null];
        return { description: l.description.trim(), unit: l.unit.trim(), quantity: l.quantity!, unitPrice: l.unitPrice!, referenceKind: k as number, referenceId: id as number | null, note: l.note.trim() || null };
      }),
      rowVersion: r?.rowVersion ?? null
    });
  }
}
