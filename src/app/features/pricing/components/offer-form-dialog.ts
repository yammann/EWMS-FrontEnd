import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ContractorResponseDto } from '@core/api/api-types';
import { ContractsService } from '@features/contracts';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { COMMON_CURRENCIES, CONFORMITIES, CONFORMITY, PricingOffer, PricingOfferInput, PricingRequest } from '../data-access/pricing.models';

interface LineRow { itemId: number; description: string; itemUnit: string; unitPrice: number | null; unit: string; conformity: number; conformityNote: string; locked: boolean; }
interface Supplier { id: number; name: string; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);
const CURRENCY = /^[A-Z]{3}$/;

/**
 * عرض مورد على طلب التسعير (تسجيل وتعديل): المورد من سجل الفرع (واحد لكل طلب)، وعملة واحدة للعرض، وسعر الوحدة لكل بند يعرضه المورد
 * مع وحدته ومطابقته الفنية. وحدة تخالف وحدة البند تُسجَّل كما عُرضت ويُعرض البند «غير قابل للمقارنة» (لا تحويل بين الوحدات).
 * السطر المختار لا يُعدَّل قبل إلغاء اختياره.
 */
@Component({
  selector: 'app-pricing-offer-form-dialog', standalone: true,
  imports: [FormsModule, Alert, Modal],
  styles: [`
    .line-row { display: grid; grid-template-columns: 1.5fr 120px 90px 130px 1.2fr; gap: 8px; align-items: center; margin-bottom: 8px; }
    .line-row .what { display: grid; gap: 2px; }
    .line-row .what small { color: var(--ink-500); }
    @media (max-width: 760px) { .line-row { grid-template-columns: 1fr; } }
  `],
  template: `
    <app-modal [heading]="offer() ? 'تعديل العرض' : 'عرض مورد جديد'" [subheading]="request().number" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="localError() || error()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المورد</span>
              <select name="s" [(ngModel)]="supplierId" [disabled]="!!offer()">
                <option [ngValue]="0">اختر المورد</option>
                @for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">رقم العرض <small class="hint">(اختياري)</small></span><input name="n" [(ngModel)]="offerNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">تاريخ الاستلام</span><input name="r" type="date" [(ngModel)]="receivedAt" [max]="todayValue"></label>
            <label class="form-field"><span class="form-label">صلاحية العرض <small class="hint">(اختياري — العرض المنتهي لا يُختار)</small></span><input name="v" type="date" [(ngModel)]="validUntil"></label>
          </div>
          <label class="form-field"><span class="form-label">العملة <small class="hint">(رمز من ثلاثة أحرف؛ لا يُحوَّل بين العملات ولا تُجمع)</small></span>
            <input name="c" [(ngModel)]="currency" list="pricing-currencies" maxlength="3" dir="ltr" autocomplete="off" style="max-width: 120px; text-transform: uppercase">
            <datalist id="pricing-currencies">@for (c of currencies; track c) { <option [value]="c"></option> }</datalist></label>

          <div class="form-field"><span class="form-label">أسعار البنود <small class="hint">(اترك السعر فارغاً لبند لا يعرضه المورد)</small></span>
            @for (l of lines; track l.itemId) {
              <div class="line-row">
                <div class="what"><strong>{{ l.description }}</strong><small>وحدة البند: {{ l.itemUnit }}</small></div>
                <input [name]="'p' + l.itemId" type="number" min="0" step="any" [(ngModel)]="l.unitPrice" placeholder="سعر الوحدة" [disabled]="l.locked">
                <input [name]="'u' + l.itemId" [(ngModel)]="l.unit" placeholder="الوحدة" maxlength="30" [disabled]="l.locked">
                <select [name]="'m' + l.itemId" [(ngModel)]="l.conformity" [disabled]="l.locked" aria-label="المطابقة">
                  @for (c of conformities; track c.value) { <option [ngValue]="c.value">{{ c.label }}</option> }
                </select>
                <input [name]="'x' + l.itemId" [(ngModel)]="l.conformityNote" placeholder="ملاحظة المطابقة" maxlength="1000" [disabled]="l.locked">
              </div>
            }
            @if (hasLocked()) { <small class="hint">السطور المختارة مقفلة: ألغِ اختيارها من جدول المقارنة قبل تعديلها.</small> }
          </div>

          <label class="form-field"><span class="form-label">شروط التوريد <small class="hint">(اختياري)</small></span><textarea name="t" [(ngModel)]="supplyTerms" rows="2" maxlength="2000"></textarea></label>
          <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span><textarea name="o" [(ngModel)]="note" rows="2" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button><button type="submit" [disabled]="busy()">{{ offer() ? 'حفظ' : 'تسجيل العرض' }}</button></footer>
      </form>
    </app-modal>`
})
export class OfferFormDialog {
  private contracts = inject(ContractsService);

  request = input.required<PricingRequest>();
  offer = input<PricingOffer | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<PricingOfferInput>();
  closed = output<void>();

  currencies = COMMON_CURRENCIES;
  conformities = CONFORMITIES;
  todayValue = today();
  suppliers = signal<Supplier[]>([]);
  localError = signal('');

  supplierId = 0; offerNumber = ''; receivedAt = today(); validUntil = ''; currency = ''; supplyTerms = ''; note = '';
  lines: LineRow[] = [];

  constructor() {
    queueMicrotask(() => this.init());
  }

  private init() {
    const r = this.request(), o = this.offer();
    this.lines = r.items.map(i => {
      const line = o?.lines.find(l => l.itemId === i.id);
      return {
        itemId: i.id, description: i.description, itemUnit: i.unit, unitPrice: line?.unitPrice ?? null, unit: line?.unit ?? i.unit,
        conformity: line?.conformity ?? CONFORMITY.notEvaluated, conformityNote: line?.conformityNote ?? '', locked: !!line?.isSelected
      };
    });
    if (o) {
      this.supplierId = o.supplierId; this.offerNumber = o.offerNumber ?? ''; this.receivedAt = day(o.receivedAt); this.validUntil = day(o.validUntil);
      this.currency = o.currency; this.supplyTerms = o.supplyTerms; this.note = o.note;
    }
    this.contracts.contractors(r.branchId).subscribe({
      next: (list: ContractorResponseDto[]) => {
        // مورد واحد لكل طلب، وغير النشط لا يُختار
        const used = new Set(r.offers.filter(x => x.id !== o?.id).map(x => x.supplierId));
        this.suppliers.set(list.filter(c => c.isActive && !used.has(c.id)).map(c => ({ id: c.id, name: c.name })));
      },
      error: () => this.suppliers.set([])
    });
  }

  hasLocked() { return this.lines.some(l => l.locked); }

  submit() {
    this.localError.set('');
    const currency = this.currency.trim().toUpperCase();
    if (!this.supplierId) { this.localError.set('اختر المورد'); return; }
    if (!CURRENCY.test(currency)) { this.localError.set('العملة رمز من ثلاثة أحرف لاتينية (مثل SYP)'); return; }
    if (this.validUntil && this.validUntil < this.receivedAt) { this.localError.set('صلاحية العرض لا تسبق تاريخ استلامه'); return; }
    const priced = this.lines.filter(l => l.unitPrice !== null && l.unitPrice !== undefined && `${l.unitPrice}` !== '');
    if (!priced.length) { this.localError.set('أدخل سعر بند واحد على الأقل'); return; }
    const bad = priced.find(l => l.unitPrice! < 0 || !l.unit.trim());
    if (bad) { this.localError.set(`«${bad.description}»: سعر غير سالب ووحدة مطلوبان`); return; }
    const o = this.offer();
    this.submitted.emit({
      supplierId: this.supplierId, offerNumber: this.offerNumber.trim() || null, receivedAt: this.receivedAt, validUntil: this.validUntil || null,
      currency, supplyTerms: this.supplyTerms.trim() || null, note: this.note.trim() || null, documentVersionId: o?.documentVersionId ?? null,
      lines: priced.map(l => ({ itemId: l.itemId, unitPrice: l.unitPrice!, unit: l.unit.trim(), conformity: l.conformity, conformityNote: l.conformityNote.trim() || null })),
      rowVersion: o?.rowVersion ?? null
    });
  }
}
