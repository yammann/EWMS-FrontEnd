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
import { Agreement, AgreementInput, COMMON_CURRENCIES } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';

interface LineRow { description: string; quantity: number | null; unit: string; unitPrice: number | null; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);
const CURRENCY = /^[A-Z]{3}$/;

/**
 * محضر اتفاق مع متعهد جديد (إعداد وتعديل): المتعهد من سجل الفرع، وعملة واحدة، وبنود بكمية ووحدة وسعر وحدة؛ والإجمالي يُحسب للعرض فقط
 * (الخادم يحسبه ويحفظه). الإعداد لمدير المكتب وحده، والاعتماد لغير من أعدّه.
 */
@Component({
  selector: 'app-pricing-agreement-form-dialog', standalone: true,
  imports: [DecimalPipe, FormsModule, Alert, Modal],
  styles: [`
    .line-row { display: grid; grid-template-columns: 1.8fr 100px 90px 130px auto; gap: 8px; align-items: center; margin-bottom: 8px; }
    @media (max-width: 640px) { .line-row { grid-template-columns: 1fr; } }
    .total { font-weight: 700; margin-top: 4px; }
  `],
  template: `
    <app-modal [heading]="agreement() ? 'تعديل محضر الاتفاق' : 'محضر اتفاق جديد'" [subheading]="agreement()?.internalNumber ?? ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="localError() || error()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المتعهد</span>
              <select name="s" [(ngModel)]="supplierId"><option [ngValue]="0">اختر المتعهد</option>@for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</select></label>
            <label class="form-field"><span class="form-label">رقم المحضر الرسمي <small class="hint">(اختياري — فريد داخل الفرع)</small></span><input name="n" [(ngModel)]="number" maxlength="100" dir="ltr" autocomplete="off"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">تاريخ المحضر</span><input name="dt" type="date" [(ngModel)]="agreementDate"></label>
            <label class="form-field"><span class="form-label">العملة <small class="hint">(رمز من ثلاثة أحرف)</small></span>
              <input name="c" [(ngModel)]="currency" list="agreement-currencies" maxlength="3" dir="ltr" autocomplete="off" style="max-width: 120px; text-transform: uppercase">
              <datalist id="agreement-currencies">@for (c of currencies; track c) { <option [value]="c"></option> }</datalist></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المشروع <small class="hint">(اختياري)</small></span>
              <select name="p" [ngModel]="projectId()" (ngModelChange)="pickProject($event)">
                <option [ngValue]="null">بلا مشروع</option>@for (p of projectList(); track p.id) { <option [ngValue]="p.id">{{ p.number }} — {{ p.name }}</option> }
              </select></label>
            @if (projectId()) {
              <label class="form-field"><span class="form-label">العقد <small class="hint">(اختياري)</small></span>
                <select name="ct" [(ngModel)]="contractId"><option [ngValue]="null">بلا عقد</option>@for (c of contracts(); track c.id) { <option [ngValue]="c.id">{{ c.number }}</option> }</select></label>
            } @else if (canChooseBranch() && !agreement()) {
              <label class="form-field"><span class="form-label">الفرع</span>
                <select name="b" [(ngModel)]="branchId"><option [ngValue]="null">فرعي</option>@for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }</select></label>
            }
          </div>

          <div class="form-field"><span class="form-label">البنود</span>
            @for (l of rows; track $index) {
              <div class="line-row">
                <input [name]="'d' + $index" [(ngModel)]="l.description" placeholder="وصف البند" maxlength="300">
                <input [name]="'q' + $index" type="number" min="0" step="any" [(ngModel)]="l.quantity" placeholder="الكمية">
                <input [name]="'u' + $index" [(ngModel)]="l.unit" placeholder="الوحدة" maxlength="30">
                <input [name]="'p' + $index" type="number" min="0" step="any" [(ngModel)]="l.unitPrice" placeholder="سعر الوحدة">
                <button type="button" class="btn btn-ghost btn-sm" (click)="removeRow($index)" [disabled]="rows.length < 2">حذف</button>
              </div>
            }
            <button type="button" class="btn btn-ghost btn-sm" (click)="addRow()">+ بند</button>
            <p class="total">الإجمالي: {{ total() | number:'1.0-2' }} {{ currency.toUpperCase() }}</p>
          </div>

          <label class="form-field"><span class="form-label">المواصفات الفنية <small class="hint">(اختياري)</small></span><textarea name="ts" [(ngModel)]="technicalSpecs" rows="2" maxlength="4000"></textarea></label>
          <label class="form-field"><span class="form-label">طريقة التنفيذ <small class="hint">(اختياري)</small></span><textarea name="em" [(ngModel)]="executionMethod" rows="2" maxlength="2000"></textarea></label>
          <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span><textarea name="no" [(ngModel)]="notes" rows="2" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button><button type="submit" [disabled]="busy()">{{ agreement() ? 'حفظ' : 'حفظ كمسوّدة' }}</button></footer>
      </form>
    </app-modal>`
})
export class AgreementFormDialog {
  private service = inject(PricingService);
  private contractsService = inject(ContractsService);
  private projects = inject(ProjectsService);
  private lookups = inject(LookupsService);

  agreement = input<Agreement | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<AgreementInput>();
  closed = output<void>();

  currencies = COMMON_CURRENCIES;
  suppliers = signal<{ id: number; name: string }[]>([]);
  projectList = signal<ProjectResponseDto[]>([]);
  contracts = signal<{ id: number; number: string }[]>([]);
  branches = signal<Branch[]>([]);
  localError = signal('');
  projectId = signal<number | null>(null);
  canChooseBranch = computed(() => this.service.access().canChooseBranch);

  supplierId = 0; number = ''; agreementDate = today(); currency = ''; contractId: number | null = null; branchId: number | null = null;
  technicalSpecs = ''; executionMethod = ''; notes = '';
  rows: LineRow[] = [{ description: '', quantity: null, unit: '', unitPrice: null }];

  total = () => this.rows.reduce((sum, l) => sum + (l.quantity ?? 0) * (l.unitPrice ?? 0), 0);

  constructor() {
    effect(() => {
      const a = this.agreement();
      if (!a) return;
      this.supplierId = a.supplierId; this.number = a.number ?? ''; this.agreementDate = day(a.agreementDate); this.currency = a.currency;
      this.projectId.set(a.projectId); this.contractId = a.contractId;
      this.technicalSpecs = a.technicalSpecs; this.executionMethod = a.executionMethod; this.notes = a.notes;
      this.rows = a.lines.map(l => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice }));
      if (a.projectId) this.loadContracts(a.projectId);
    });
    this.contractsService.contractors(null).subscribe({
      next: (list: ContractorResponseDto[]) => this.suppliers.set(list.filter(c => c.isActive).map(c => ({ id: c.id, name: c.name }))),
      error: () => this.suppliers.set([])
    });
    // المشاريع التي يراها المستخدم (قد لا يملك «عرض المشاريع»: يبقى المحضر بلا مشروع)
    this.projects.search({ search: '', branchId: null, departmentId: null, siteId: null, stage: null, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.projectList.set(page.items as ProjectResponseDto[]), error: () => this.projectList.set([]) });
    if (this.service.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  private loadContracts(projectId: number) {
    this.contractsService.search({ projectId, status: null, method: null, contractorId: null, search: '', warrantyEndingOnly: false, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.contracts.set(page.items.map(c => ({ id: c.id, number: c.number }))), error: () => this.contracts.set([]) });
  }

  pickProject(id: number | null) {
    this.projectId.set(id); this.contractId = null; this.contracts.set([]);
    if (id) this.loadContracts(id);
  }

  addRow() { this.rows = [...this.rows, { description: '', quantity: null, unit: '', unitPrice: null }]; }
  removeRow(i: number) { this.rows = this.rows.filter((_, k) => k !== i); }

  submit() {
    this.localError.set('');
    const currency = this.currency.trim().toUpperCase();
    if (!this.supplierId) { this.localError.set('اختر المتعهد'); return; }
    if (!CURRENCY.test(currency)) { this.localError.set('العملة رمز من ثلاثة أحرف لاتينية (مثل SYP)'); return; }
    const bad = this.rows.findIndex(r => !r.description.trim() || !r.unit.trim() || !r.quantity || r.quantity <= 0 || r.unitPrice === null || r.unitPrice < 0);
    if (bad >= 0) { this.localError.set(`البند ${bad + 1}: الوصف والوحدة وكمية أكبر من صفر وسعر غير سالب مطلوبة`); return; }
    const a = this.agreement();
    this.submitted.emit({
      supplierId: this.supplierId, number: this.number.trim() || null, agreementDate: this.agreementDate, currency,
      projectId: this.projectId(), contractId: this.projectId() ? this.contractId : null, pricingRequestId: a?.pricingRequestId ?? null,
      branchId: this.projectId() || a ? null : this.branchId,
      technicalSpecs: this.technicalSpecs.trim() || null, executionMethod: this.executionMethod.trim() || null, notes: this.notes.trim() || null,
      documentVersionId: a?.documentVersionId ?? null,
      lines: this.rows.map(r => ({ description: r.description.trim(), quantity: r.quantity!, unit: r.unit.trim(), unitPrice: r.unitPrice! })),
      rowVersion: a?.rowVersion ?? null
    });
  }
}
