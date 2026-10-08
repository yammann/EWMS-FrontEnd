import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MaintenanceService } from '@core/services/maintenance.service';
import { MaintenanceLookup, utcDate } from '@core/models/maintenance.models';
import { NamedRef, SparePart, SparePartMovement, money, qty, twoDecimals } from '@core/models/spare-part.models';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';

const decimal2 = (c: AbstractControl<number | null>) => c.value == null || twoDecimals(c.value) ? null : { decimals: true };

function todayInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** إضافة قطعة أو تعديل بياناتها — الكمية والسعر لا يُدخلان هنا (إدخال/تسوية فقط) */
@Component({
  selector: 'app-spare-part-form-dialog', standalone: true, imports: [ReactiveFormsModule, Modal],
  styleUrl: '../devices/devices.scss',
  template: `
    <app-modal [heading]="part() ? 'تعديل قطعة غيار' : 'قطعة غيار جديدة'" [subheading]="part()?.departmentName ?? 'تُضاف برصيد صفر — ثم «إدخال» لاستلام الكميات'"
               size="lg" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          <div class="form-grid-2">
            @if (!part() && departments().length > 1) {
              <label class="form-field full"><span class="form-label">مخزون القسم</span>
                <select formControlName="departmentId"><option [ngValue]="0">اختر القسم</option>
                  @for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.name }}</option> }</select></label>
            }
            <label class="form-field"><span class="form-label">اسم القطعة</span><input formControlName="name" maxlength="200" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">رقم القطعة <small class="hint">(اختياري)</small></span><input formControlName="partNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">الوحدة</span><input formControlName="unit" maxlength="30" list="part-units" placeholder="قطعة، متر، علبة…">
              <datalist id="part-units"><option value="قطعة"></option><option value="متر"></option><option value="علبة"></option><option value="لتر"></option><option value="طقم"></option></datalist></label>
            <label class="form-field"><span class="form-label">الحد الأدنى للتنبيه</span><input type="number" formControlName="minQuantity" min="0" step="0.01" dir="ltr">
              <small class="hint">إشعار لمن يُدخل المخزون عند النزول تحته (0 = بلا تنبيه)</small>
              @if (form.controls.minQuantity.invalid) { <small class="form-error">رقم موجب بخانتين عشريتين على الأكثر</small> }</label>
            <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="1000"></textarea></label>
          </div>

          <fieldset class="compat"><legend>التوافق <small class="hint">(اختياري — يقدّم القطعة أولاً عند الصرف على هذه الأجهزة)</small></legend>
            <div class="compat-grid">
              <div><span class="form-label">أنواع الأجهزة</span>
                <div class="checks">@for (t of deviceTypes(); track t.id) {
                  <label><input type="checkbox" [checked]="typeIds().has(t.id)" (change)="toggle(typeIds, t.id)"> {{ t.name }}</label>
                } @empty { <span class="hint">لا توجد أنواع</span> }</div></div>
              <div><span class="form-label">الشركات</span>
                <div class="checks">@for (c of companies(); track c.id) {
                  <label><input type="checkbox" [checked]="companyIds().has(c.id)" (change)="toggle(companyIds, c.id)"> {{ c.name }}</label>
                } @empty { <span class="hint">لا توجد شركات</span> }</div></div>
            </div>
          </fieldset>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="form.invalid || needsDepartment() || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .compat { border: 0; padding: 0; margin: 16px 0 0; min-width: 0; }
    .compat legend { padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--brand-700); }
    .compat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .checks { display: flex; flex-wrap: wrap; gap: 6px 14px; max-height: 150px; overflow: auto; padding: 8px 10px; border-radius: var(--radius-lg); background: var(--fill); }
    .checks label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
    @media (max-width: 640px) { .compat-grid { grid-template-columns: 1fr; } }
  `]
})
export class SparePartFormDialog implements OnInit {
  private service = inject(MaintenanceService);

  part = input<SparePart | null>(null);
  departments = input<NamedRef[]>([]);
  deviceTypes = input<MaintenanceLookup[]>([]);
  companies = input<MaintenanceLookup[]>([]);
  saved = output<SparePart>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  typeIds = signal(new Set<number>());
  companyIds = signal(new Set<number>());

  form = inject(FormBuilder).nonNullable.group({
    departmentId: [0],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    partNumber: ['', Validators.maxLength(100)],
    unit: ['قطعة', [Validators.required, Validators.maxLength(30)]],
    description: ['', Validators.maxLength(1000)],
    minQuantity: [0, [Validators.required, Validators.min(0), decimal2]]
  });

  needsDepartment = () => !this.part() && this.departments().length > 1 && !this.form.controls.departmentId.value;

  ngOnInit() {
    const p = this.part();
    if (p) {
      this.form.reset({ departmentId: p.departmentId, name: p.name, partNumber: p.partNumber, unit: p.unit, description: p.description, minQuantity: p.minQuantity });
      this.typeIds.set(new Set(p.deviceTypes.map(t => t.id)));
      this.companyIds.set(new Set(p.deviceCompanies.map(c => c.id)));
    }
  }

  toggle(target: typeof this.typeIds, id: number) {
    target.update(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  save() {
    if (this.form.invalid || this.needsDepartment() || this.saving()) return;
    const v = this.form.getRawValue();
    const departments = this.departments();
    const body = {
      departmentId: this.part() ? null : (v.departmentId || (departments.length === 1 ? departments[0].id : null)),
      name: v.name.trim(), partNumber: v.partNumber.trim(), unit: v.unit.trim(), description: v.description.trim(),
      minQuantity: Number(v.minQuantity) || 0,
      deviceTypeIds: [...this.typeIds()], deviceCompanyIds: [...this.companyIds()]
    };
    const p = this.part();
    this.saving.set(true); this.error.set('');
    (p ? this.service.updatePart(p.id, body) : this.service.createPart(body)).subscribe({
      next: r => { this.saving.set(false); this.saved.emit(r); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}

/** إدخال (استلام كمية بسعرها وتاريخها ومصدرها) أو تسوية (جرد / تالف) */
@Component({
  selector: 'app-spare-part-stock-dialog', standalone: true, imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal [heading]="(mode() === 'receive' ? 'إدخال: ' : 'تسوية: ') + part().name"
               [subheading]="'الرصيد الحالي ' + qty(part().quantity) + ' ' + part().unit + ' · متوسط السعر ' + money(part().averageCost)"
               [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @if (mode() === 'receive') {
            <label class="form-field"><span class="form-label">الكمية المستلمة ({{ part().unit }})</span><input type="number" formControlName="quantity" min="0.01" step="0.01" dir="ltr"></label>
            <label class="form-field"><span class="form-label">سعر الوحدة (ل.س)</span><input type="number" formControlName="unitCost" min="0" step="0.01" dir="ltr">
              <small class="hint">يدخل في متوسط السعر المرجّح — بعده {{ money(newAverage()) }}</small></label>
            <label class="form-field"><span class="form-label">تاريخ الاستلام</span><input type="date" formControlName="date" [max]="today"></label>
            <label class="form-field"><span class="form-label">المصدر <small class="hint">(المورّد أو الجهة — اختياري)</small></span><input formControlName="note" maxlength="500"></label>
          } @else {
            <div class="segmented" role="radiogroup" aria-label="نوع التسوية">
              <button type="button" role="radio" [class.on]="adjustKind() === 'count'" [attr.aria-checked]="adjustKind() === 'count'" (click)="setKind('count')">جرد (الكمية الفعلية)</button>
              <button type="button" role="radio" [class.on]="adjustKind() === 'damaged'" [attr.aria-checked]="adjustKind() === 'damaged'" (click)="setKind('damaged')">تالف أو مفقود</button>
            </div>
            <label class="form-field"><span class="form-label">{{ adjustKind() === 'count' ? 'الكمية الموجودة فعلاً' : 'الكمية التالفة' }} ({{ part().unit }})</span>
              <input type="number" formControlName="quantity" min="0" step="0.01" dir="ltr">
              <small class="hint">الفرق: {{ deltaText() }} — الرصيد بعدها {{ qty(part().quantity + delta()) }}</small></label>
            <label class="form-field"><span class="form-label">السبب</span><input formControlName="note" maxlength="500" [placeholder]="adjustKind() === 'count' ? 'جرد شهري…' : 'كسر أثناء التركيب…'"></label>
          }
          @if (form.controls.quantity.invalid && form.controls.quantity.touched) { <small class="form-error">كمية موجبة بخانتين عشريتين على الأكثر</small> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="!valid() || saving()">{{ saving() ? 'جارٍ الحفظ…' : (mode() === 'receive' ? 'إدخال' : 'حفظ التسوية') }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.segmented { justify-self: start; }`]
})
export class SparePartStockDialog implements OnInit {
  private service = inject(MaintenanceService);
  money = money; qty = qty;
  today = todayInput();

  part = input.required<SparePart>();
  mode = input.required<'receive' | 'adjust'>();
  saved = output<SparePart>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  adjustKind = signal<'count' | 'damaged'>('count');

  form = inject(FormBuilder).group({
    quantity: [null as number | null, [Validators.required, Validators.min(0), decimal2]],
    unitCost: [null as number | null, [Validators.min(0), decimal2]],
    date: [todayInput()],
    note: ['', Validators.maxLength(500)]
  });
  private values = signal(this.form.getRawValue());

  delta = computed(() => {
    const q = Number(this.values().quantity ?? 0);
    return this.adjustKind() === 'count' ? Math.round((q - this.part().quantity) * 100) / 100 : -q;
  });
  deltaText = computed(() => { const d = this.delta(); return d > 0 ? '+' + qty(d) : qty(d); });
  newAverage = computed(() => {
    const p = this.part(), q = Number(this.values().quantity ?? 0), c = Number(this.values().unitCost ?? 0);
    return p.quantity <= 0 || q <= 0 ? c : Math.round((p.quantity * p.averageCost + q * c) / (p.quantity + q) * 100) / 100;
  });

  ngOnInit() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
    if (this.mode() === 'adjust') this.form.patchValue({ quantity: this.part().quantity });
  }

  setKind(kind: 'count' | 'damaged') {
    this.adjustKind.set(kind);
    this.form.patchValue({ quantity: kind === 'count' ? this.part().quantity : null });
  }

  valid() {
    const v = this.values();
    if (this.form.invalid || v.quantity == null) return false;
    if (this.mode() === 'receive') return v.quantity > 0 && v.unitCost != null && v.unitCost >= 0 && !!v.date && v.date <= this.today;
    const d = this.delta();
    return d !== 0 && this.part().quantity + d >= 0 && !!v.note?.trim();
  }

  save() {
    if (!this.valid() || this.saving()) return;
    const v = this.form.getRawValue();
    const p = this.part();
    this.saving.set(true); this.error.set('');
    const request$ = this.mode() === 'receive'
      ? this.service.receivePart(p.id, { quantity: Number(v.quantity), unitCost: Number(v.unitCost), date: v.date || null, source: (v.note ?? '').trim() })
      : this.service.adjustPart(p.id, { delta: this.delta(), reason: (v.note ?? '').trim() });
    request$.subscribe({
      next: r => { this.saving.set(false); this.saved.emit(r); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}

/** سجل حركات القطعة (لا يُحذف ولا يُعدَّل) */
@Component({
  selector: 'app-spare-part-movements', standalone: true, imports: [DatePipe, RouterLink, Modal, Pager],
  styleUrls: ['../shared/organization.scss', './maintenance.scss'],
  template: `
    <app-modal [heading]="'حركات: ' + part().name" [subheading]="'الرصيد ' + qty(part().quantity) + ' ' + part().unit + ' · ' + part().departmentName"
               size="lg" (closed)="closed.emit()">
      <div class="modal-body">
        @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
        @if (loading() && !rows().length) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!rows().length) { <p class="empty-state">لا توجد حركات بعد — ابدأ بـ«إدخال»</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>التاريخ</th><th>الحركة</th><th>الكمية</th><th>سعر الوحدة</th><th>الرصيد بعدها</th><th>التفاصيل</th><th>بواسطة</th></tr></thead>
            <tbody>
              @for (m of rows(); track m.id) {
                <tr>
                  <td>{{ m.date | date:'yyyy/MM/dd' }}<small>{{ utc(m.createdAt) | date:'HH:mm' }}</small></td>
                  <td><span class="mv mv-{{ m.type }}">{{ m.typeAr }}</span></td>
                  <td class="num" [class.neg]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ qty(m.quantity) }}</td>
                  <td class="num">{{ money(m.unitCost) }}</td>
                  <td class="num">{{ qty(m.balanceAfter) }}</td>
                  <td>@if (m.maintenanceRequestId) { <a [routerLink]="['/maintenance/requests', m.maintenanceRequestId]" (click)="closed.emit()" class="mono">{{ m.requestNumber }}</a> }
                      {{ m.note }}@if (!m.note && !m.maintenanceRequestId) { — }</td>
                  <td>{{ m.userName }}</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="load($event)" />
        }
      </div>
      <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()">إغلاق</button></footer>
    </app-modal>`,
  styles: [`
    table { min-width: 0; }   /* الجدول داخل النافذة: لا يفرض عرض 700px العام */
    th, td { padding-inline: 8px; }
    td small { display: block; color: var(--ink-400); font-size: 11px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .neg { color: var(--danger-700); }
    .mv { display: inline-block; padding: 2px 10px; border-radius: var(--radius-full); font-size: 12px; font-weight: 700; background: var(--fill); }
    .mv-1 { background: var(--brand-100); color: var(--brand-800); }
    .mv-2 { background: var(--warning-100); color: var(--warning-700); }
    .mv-3 { background: var(--info-100); color: var(--info-700); }
    .mv-4 { background: var(--fill-strong); color: var(--ink-700); }
  `]
})
export class SparePartMovements implements OnInit {
  private service = inject(MaintenanceService);
  money = money; qty = qty; utc = utcDate;
  pageSize = 15;

  part = input.required<SparePart>();
  closed = output<void>();

  rows = signal<SparePartMovement[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  ngOnInit() { this.load(1); }

  load(page: number) {
    this.page.set(page); this.loading.set(true); this.error.set('');
    this.service.partMovements(this.part().id, page, this.pageSize).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
