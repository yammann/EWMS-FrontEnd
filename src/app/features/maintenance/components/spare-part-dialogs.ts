import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceLookup } from '../data-access/maintenance.models';
import { NamedRef, SparePart, SparePartMovement, twoDecimals } from '../data-access/spare-part.models';
import { qty } from '@core/utils/format';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { MoneyPipe, QtyPipe, UtcPipe } from '@shared/pipes/format.pipes';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

const decimal2 = (c: AbstractControl<number | null>) => c.value == null || twoDecimals(c.value) ? null : { decimals: true };

/** إضافة قطعة أو تعديل بياناتها — الكمية والسعر لا يُدخلان هنا (إدخال/تسوية فقط) */
@Component({
  selector: 'app-spare-part-form-dialog', standalone: true, imports: [FormActions, Alert, ReactiveFormsModule, Modal],
  styleUrl: '../../../shared/styles/devices.scss',
  templateUrl: './spare-part-dialogs-spare-part-form-dialog.html',
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
    trackRequest((p ? this.service.updatePart(p.id, body) : this.service.createPart(body)), this.saving, this.error, r => { this.saved.emit(r); });
  }
}

/** إدخال (استلام كمية بسعرها وتاريخها ومصدرها) أو تسوية (جرد / تالف) */
@Component({
  selector: 'app-spare-part-stock-dialog', standalone: true, imports: [Alert, QtyPipe, MoneyPipe, ReactiveFormsModule, Modal],
  templateUrl: './spare-part-dialogs-spare-part-stock-dialog.html',
  styles: [`.segmented { justify-self: start; }`]
})
export class SparePartStockDialog implements OnInit {
  private service = inject(MaintenanceService);
  today = localDateInput();

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
    date: [localDateInput()],
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
  selector: 'app-spare-part-movements', standalone: true, imports: [EmptyState, Alert, UtcPipe, QtyPipe, MoneyPipe, DatePipe, RouterLink, Modal, Pager],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/maintenance.scss'],
  templateUrl: './spare-part-dialogs-spare-part-movements.html',
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
    this.page.set(page); trackRequest(this.service.partMovements(this.part().id, page, this.pageSize), this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }
}
