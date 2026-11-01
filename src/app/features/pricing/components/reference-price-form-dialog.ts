import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import type { ContractorResponseDto, ProjectResponseDto } from '@core/api/api-types';
import { ContractsService } from '@features/contracts';
import { ProjectsService } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { COMMON_CURRENCIES, REFERENCE_SOURCES, ReferencePrice, ReferencePriceInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';

/** ما يُرسَل: بيانات السعر، ومعها سبب التصحيح ونسخة المُصحَّح عند التصحيح */
export type ReferencePriceSubmit = ReferencePriceInput & { reason?: string; rowVersion?: string | null };

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';
const today = () => new Date().toISOString().slice(0, 10);
const CURRENCY = /^[A-Z]{3}$/;

/**
 * إضافة سعر مرجعي أو تصحيحه. السجل تاريخي لا يُعدَّل: «تصحيح» يُنشئ سجلاً بديلاً بسبب مكتوب ويبقى القديم في التاريخ.
 * لا سعر بلا مصدر وتاريخ؛ والمورد من سجل مقاولي الفرع؛ وسعر بوحدة أو عملة مختلفة مادة أخرى في التجميع (لا مقارنة بينهما).
 */
@Component({
  selector: 'app-reference-price-form-dialog', standalone: true,
  imports: [FormsModule, Alert, Modal],
  template: `
    <app-modal [heading]="price() ? 'تصحيح سعر مرجعي' : 'سعر مرجعي جديد'" [subheading]="price()?.number ?? ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="localError() || error()" />
          @if (price()) { <p class="hint">لا يُعدَّل السعر المسجَّل: يُنشأ سجل بديل بالبيانات أدناه ويبقى القديم ظاهراً في التاريخ. البديل بانتظار الاعتماد.</p> }
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">رمز المادة <small class="hint">(اختياري — إن وُجد جُمعت به الأسعار)</small></span><input name="code" [(ngModel)]="itemCode" maxlength="50" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">اسم المادة أو المنتج</span><input name="name" [(ngModel)]="itemName" maxlength="200" autocomplete="off"></label>
          </div>
          <label class="form-field"><span class="form-label">المواصفات <small class="hint">(اختياري)</small></span><textarea name="spec" [(ngModel)]="specifications" rows="2" maxlength="2000"></textarea></label>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المورد</span>
              <select name="s" [(ngModel)]="supplierId"><option [ngValue]="0">اختر المورد</option>@for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</select></label>
            <label class="form-field"><span class="form-label">تاريخ السعر</span><input name="date" type="date" [(ngModel)]="priceDate" [max]="todayValue"></label>
          </div>
          <div class="form-grid-3">
            <label class="form-field"><span class="form-label">سعر الوحدة</span><input name="p" type="number" min="0" step="any" [(ngModel)]="unitPrice"></label>
            <label class="form-field"><span class="form-label">الوحدة</span><input name="u" [(ngModel)]="unit" maxlength="30" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">العملة <small class="hint">(ثلاثة أحرف)</small></span>
              <input name="c" [(ngModel)]="currency" list="reference-currencies" maxlength="3" dir="ltr" autocomplete="off" style="text-transform: uppercase">
              <datalist id="reference-currencies">@for (c of currencies; track c) { <option [value]="c"></option> }</datalist></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">نوع المصدر</span>
              <select name="src" [(ngModel)]="source">@for (s of sources; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }</select></label>
            <label class="form-field"><span class="form-label">مصدر السعر <small class="hint">(رقم عرض السعر أو وصف المستند — مطلوب)</small></span><input name="doc" [(ngModel)]="sourceDocument" maxlength="200" autocomplete="off"></label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المشروع <small class="hint">(اختياري)</small></span>
              <select name="proj" [(ngModel)]="projectId"><option [ngValue]="null">بلا مشروع</option>@for (p of projectList(); track p.id) { <option [ngValue]="p.id">{{ p.number }} — {{ p.name }}</option> }</select></label>
            @if (canChooseBranch() && !projectId && !price()) {
              <label class="form-field"><span class="form-label">الفرع</span>
                <select name="b" [(ngModel)]="branchId"><option [ngValue]="null">فرعي</option>@for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }</select></label>
            }
          </div>
          <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span><textarea name="notes" [(ngModel)]="notes" rows="2" maxlength="2000"></textarea></label>
          @if (price()) {
            <label class="form-field"><span class="form-label">سبب التصحيح <small class="hint">(مطلوب)</small></span><textarea name="reason" [(ngModel)]="reason" rows="2" maxlength="1000"></textarea></label>
          }
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button><button type="submit" [disabled]="busy()">{{ price() ? 'حفظ التصحيح' : 'إضافة السعر' }}</button></footer>
      </form>
    </app-modal>`
})
export class ReferencePriceFormDialog {
  private service = inject(PricingService);
  private contracts = inject(ContractsService);
  private projects = inject(ProjectsService);
  private lookups = inject(LookupsService);

  /** السعر المُصحَّح (null = إضافة سعر جديد) */
  price = input<ReferencePrice | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<ReferencePriceSubmit>();
  closed = output<void>();

  currencies = COMMON_CURRENCIES;
  sources = REFERENCE_SOURCES;
  todayValue = today();
  suppliers = signal<{ id: number; name: string }[]>([]);
  projectList = signal<ProjectResponseDto[]>([]);
  branches = signal<Branch[]>([]);
  localError = signal('');
  canChooseBranch = computed(() => this.service.access().canChooseBranch);

  itemCode = ''; itemName = ''; specifications = ''; unit = ''; currency = ''; supplierId = 0; unitPrice: number | null = null;
  priceDate = today(); source: number = 2; sourceDocument = ''; notes = ''; reason = '';
  projectId: number | null = null; branchId: number | null = null;

  constructor() {
    effect(() => {
      const p = this.price();
      if (!p) return;
      this.itemCode = p.itemCode ?? ''; this.itemName = p.itemName; this.specifications = p.specifications; this.unit = p.unit; this.currency = p.currency;
      this.supplierId = p.supplierId; this.unitPrice = p.unitPrice; this.priceDate = day(p.priceDate); this.source = p.source === 1 ? 1 : 2;
      this.sourceDocument = p.sourceDocument; this.notes = p.notes; this.projectId = p.projectId;
    });
    this.contracts.contractors(null).subscribe({
      next: (list: ContractorResponseDto[]) => this.suppliers.set(list.filter(c => c.isActive).map(c => ({ id: c.id, name: c.name }))),
      error: () => this.suppliers.set([])
    });
    // المشاريع التي يراها المستخدم (قد لا يملك «عرض المشاريع»: يبقى السعر بلا مشروع)
    this.projects.search({ search: '', branchId: null, departmentId: null, siteId: null, stage: null, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.projectList.set(page.items as ProjectResponseDto[]), error: () => this.projectList.set([]) });
    if (this.service.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  submit() {
    this.localError.set('');
    const currency = this.currency.trim().toUpperCase();
    if (!this.itemName.trim()) { this.localError.set('اكتب اسم المادة أو المنتج'); return; }
    if (!this.supplierId) { this.localError.set('اختر المورد'); return; }
    if (this.unitPrice === null || this.unitPrice < 0) { this.localError.set('سعر الوحدة رقم غير سالب'); return; }
    if (!this.unit.trim()) { this.localError.set('اكتب وحدة السعر'); return; }
    if (!CURRENCY.test(currency)) { this.localError.set('العملة رمز من ثلاثة أحرف لاتينية (مثل SYP)'); return; }
    if (!this.sourceDocument.trim()) { this.localError.set('اكتب مصدر السعر: لا سعر بلا مصدر'); return; }
    const p = this.price();
    if (p && !this.reason.trim()) { this.localError.set('اكتب سبب التصحيح'); return; }
    this.submitted.emit({
      branchId: this.projectId || p ? null : this.branchId, itemCode: this.itemCode.trim() || null, itemName: this.itemName.trim(), specifications: this.specifications.trim() || null,
      unit: this.unit.trim(), supplierId: this.supplierId, unitPrice: this.unitPrice, currency, priceDate: this.priceDate, projectId: this.projectId,
      source: this.source, sourceDocument: this.sourceDocument.trim(), documentVersionId: p?.documentVersionId ?? null, notes: this.notes.trim() || null,
      ...(p ? { reason: this.reason.trim(), rowVersion: p.rowVersion } : {})
    });
  }
}
