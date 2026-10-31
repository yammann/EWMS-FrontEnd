import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { CONTRACT_METHODS, CONTRACT_STATUS, CURRENCIES, Contract, ContractInput, Contractor } from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const orNull = (v: string) => v.trim() || null;

/**
 * فتح عقد على مشروع أو تعديل بياناته. المبالغ والمدد وتواريخ الضمان تُدخَل كما اعتُمدت (لا معادلات؛ نهاية الضمان تُقترح من البداية والمدة ولا تُكتب
 * وحدها). حقول المناقصة لطبيعة «مناقصة» فقط، والمتعاقد معه يُدخَل مباشرة في التنفيذ المباشر ويُحدَّد بالإرساء في غيره. بعد سريان العقد تتجمّد
 * الطبيعة والمتعاقد والقيمة والمدة (يغيّرها ملحق معتمد).
 */
@Component({
  selector: 'app-contract-form-dialog', standalone: true,
  imports: [FormsModule, Alert, Modal],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="contract() ? 'تعديل العقد' : 'عقد جديد'" [subheading]="contract() ? contract()!.number : ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />

          @if (frozen) { <p class="hint">العقد ساري: الطبيعة والمتعاقد والقيمة والمدة لا تتغير هنا — سجّل ملحقاً معتمداً لتغييرها.</p> }

          <fieldset class="form-field" [disabled]="frozen">
            <legend class="form-label">طبيعة التعاقد</legend>
            <div class="modes" role="radiogroup">
              @for (m of methods; track m.value) {
                <label class="mode" [class.on]="method === m.value">
                  <input type="radio" name="method" [value]="m.value" [(ngModel)]="method"><strong>{{ m.label }}</strong><small>{{ m.hint }}</small>
                </label>
              }
            </div>
          </fieldset>

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">رقم أمر التنفيذ <small class="hint">(اختياري)</small></span>
              <input name="eon" [(ngModel)]="executionOrderNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">تاريخ أمر التنفيذ <small class="hint">(اختياري)</small></span>
              <input name="eod" type="date" [(ngModel)]="executionOrderDate"></label>
          </div>

          @if (method === 1) {
            <label class="form-field"><span class="form-label">المتعاقد معه</span>
              <select name="contractor" [(ngModel)]="contractorId" [disabled]="frozen">
                <option [ngValue]="null">— اختر لاحقاً —</option>
                @for (c of contractors(); track c.id) { <option [ngValue]="c.id">{{ c.name }}{{ c.isActive ? '' : ' (معطّل)' }}</option> }
              </select></label>
          } @else if (contract()?.contractorName) {
            <p class="hint">المتعاقد معه (بالإرساء): <strong>{{ contract()!.contractorName }}</strong></p>
          }

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الرقم الرسمي للعقد <small class="hint">(يُدخَل عند إبرامه)</small></span>
              <input name="number" [(ngModel)]="number" maxlength="100" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">تاريخ العقد</span>
              <input name="cd" type="date" [(ngModel)]="contractDate"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">بدء التنفيذ</span>
              <input name="sd" type="date" [(ngModel)]="startDate"></label>
            <label class="form-field"><span class="form-label">مدة التنفيذ (يوم)</span>
              <input name="dd" type="number" min="1" [(ngModel)]="durationDays" [disabled]="frozen"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">القيمة التعاقدية</span>
              <input name="value" type="number" min="0" step="0.01" [(ngModel)]="value" [disabled]="frozen"></label>
            <label class="form-field"><span class="form-label">العملة</span>
              <select name="currency" [(ngModel)]="currency">@for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }</select></label>
          </div>
          <label class="form-field"><span class="form-label">نطاق الأعمال <small class="hint">(اختياري)</small></span>
            <textarea name="scope" [(ngModel)]="scope" rows="2" maxlength="4000"></textarea></label>

          @if (method === 2) {
            <fieldset class="form-field">
              <legend class="form-label">المناقصة</legend>
              <div class="form-grid-2">
                <label class="form-field"><span class="form-label">رقم المناقصة</span>
                  <input name="tn" [(ngModel)]="tenderNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
                <label class="form-field"><span class="form-label">إرسالها للمركزية</span>
                  <input name="ts" type="date" [(ngModel)]="tenderSentAt"></label>
              </div>
              <div class="form-grid-2">
                <label class="form-field"><span class="form-label">فضّها</span>
                  <input name="to" type="date" [(ngModel)]="tenderOpenedAt"></label>
                <label class="form-field"><span class="form-label">الإرساء</span>
                  <input name="aw" type="date" [(ngModel)]="awardedAt"></label>
              </div>
            </fieldset>
          }

          <fieldset class="form-field">
            <legend class="form-label">الضمان <small class="hint">(تواريخه تُدخَل بحسب القواعد الرسمية)</small></legend>
            <div class="form-grid-3">
              <label class="form-field"><span class="form-label">المدة (شهر)</span>
                <input name="wm" type="number" min="1" [(ngModel)]="warrantyMonths"></label>
              <label class="form-field"><span class="form-label">بدايته</span>
                <input name="ws" type="date" [(ngModel)]="warrantyStart"></label>
              <label class="form-field"><span class="form-label">نهايته</span>
                <input name="we" type="date" [(ngModel)]="warrantyEnd"></label>
            </div>
            @if (suggestedEnd(); as s) { <small class="hint">المقترح من البداية والمدة: {{ s }} <button type="button" class="btn btn-ghost btn-sm" (click)="warrantyEnd = s">استعمله</button></small> }
          </fieldset>

          <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span>
            <textarea name="notes" [(ngModel)]="notes" rows="2" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : contract() ? 'حفظ' : 'فتح العقد' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .mode { display: grid; gap: 2px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; }
    .mode input { position: absolute; opacity: 0; pointer-events: none; }
    .mode.on { border-color: var(--brand-600); background: var(--brand-50); }
    .mode small { color: var(--ink-500); }
    .form-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  `]
})
export class ContractFormDialog implements OnInit {
  private service = inject(ContractsService);

  projectId = input.required<number>();
  branchId = input.required<number>();
  /** التعديل: العقد نفسه */
  contract = input<Contract | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<ContractInput>();
  closed = output<void>();

  methods = CONTRACT_METHODS;
  currencies = CURRENCIES;
  contractors = signal<Contractor[]>([]);

  method = 1; contractorId: number | null = null; number = ''; executionOrderNumber = ''; executionOrderDate = ''; contractDate = ''; startDate = '';
  durationDays: number | null = null; value: number | null = null; currency = 'SYP'; scope = ''; notes = '';
  tenderNumber = ''; tenderSentAt = ''; tenderOpenedAt = ''; awardedAt = '';
  warrantyMonths: number | null = null; warrantyStart = ''; warrantyEnd = '';

  /** بعد السريان تتجمّد الطبيعة والمتعاقد والقيمة والمدة */
  get frozen() { const c = this.contract(); return !!c && c.status !== CONTRACT_STATUS.contracting; }

  ngOnInit() {
    this.service.contractors(this.branchId(), true).subscribe({ next: c => this.contractors.set(c), error: () => this.contractors.set([]) });
    const c = this.contract();
    if (!c) return;
    this.method = c.method; this.contractorId = c.contractorId; this.number = c.officialNumber ?? ''; this.executionOrderNumber = c.executionOrderNumber ?? '';
    this.executionOrderDate = day(c.executionOrderDate); this.contractDate = day(c.contractDate); this.startDate = day(c.startDate);
    this.durationDays = c.durationDays; this.value = c.value; this.currency = c.currency; this.scope = c.scope; this.notes = c.notes;
    this.tenderNumber = c.tenderNumber ?? ''; this.tenderSentAt = day(c.tenderSentAt); this.tenderOpenedAt = day(c.tenderOpenedAt); this.awardedAt = day(c.awardedAt);
    this.warrantyMonths = c.warrantyMonths; this.warrantyStart = day(c.warrantyStart); this.warrantyEnd = day(c.warrantyEnd);
  }

  /** اقتراح نهاية الضمان: البداية + المدة بالأشهر − يوم (للعرض فقط؛ لا يُكتب وحده) */
  suggestedEnd() {
    if (!this.warrantyStart || !this.warrantyMonths || this.warrantyMonths < 1) return '';
    const d = new Date(this.warrantyStart + 'T00:00:00');
    d.setMonth(d.getMonth() + this.warrantyMonths);
    d.setDate(d.getDate() - 1);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  save() {
    if (this.busy()) return;
    const tender = this.method === 2;
    this.submitted.emit({
      projectId: this.projectId(), correspondenceId: this.contract()?.correspondenceId ?? null,
      executionOrderNumber: orNull(this.executionOrderNumber), executionOrderDate: this.executionOrderDate || null,
      method: this.method, contractorId: this.method === 1 ? this.contractorId : this.contract()?.contractorId ?? null,
      number: orNull(this.number), contractDate: this.contractDate || null, startDate: this.startDate || null, durationDays: this.durationDays || null,
      value: this.value === null || this.value === undefined ? null : this.value, currency: this.currency, scope: orNull(this.scope), notes: orNull(this.notes),
      tenderNumber: tender ? orNull(this.tenderNumber) : null, tenderSentAt: tender ? this.tenderSentAt || null : null,
      tenderOpenedAt: tender ? this.tenderOpenedAt || null : null, awardedAt: tender ? this.awardedAt || null : null, awardNote: tender ? this.contract()?.awardNote ?? null : null,
      warrantyMonths: this.warrantyMonths || null, warrantyStart: this.warrantyStart || null, warrantyEnd: this.warrantyEnd || null,
      rowVersion: this.contract()?.rowVersion ?? null
    });
  }
}
