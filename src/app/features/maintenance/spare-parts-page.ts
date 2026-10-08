import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { MaintenanceService } from '@core/services/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceLookup } from '@core/models/maintenance.models';
import { NamedRef, SparePart } from '@core/models/spare-part.models';
import { qty } from '@core/utils/format';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Pager } from '@shared/ui/pager';
import { SparePartFormDialog, SparePartMovements, SparePartStockDialog } from './spare-part-dialogs';
import { MoneyPipe, QtyPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

const PAGE_SIZE = 25;

/**
 * مخزون قطع الغيار (api/SpareParts): مخزون لكل قسم — الكمية ومتوسط السعر يتغيّران بالإدخال والصرف والتسوية فقط،
 * وكل حركة في سجل لا يُحذف.
 */
@Component({
  selector: 'app-spare-parts-page', standalone: true,
  imports: [PageHeader, EmptyState, Alert, QtyPipe, MoneyPipe, RouterLink, Pager, SparePartFormDialog, SparePartStockDialog, SparePartMovements],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss', './requests-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="الصيانة" heading="قطع الغيار" subtitle="مخزون {{ departments().length === 1 ? departments()[0].name : 'الأقسام' }} — الرصيد يتغيّر بالإدخال والصرف على الطلبات والتسوية">
        @if (can().viewPartReports) { <a class="btn btn-ghost" routerLink="/maintenance/parts/report">تقارير القطع</a> }
                  @if (can().createPart) { <button class="btn" type="button" (click)="openForm(null)" [disabled]="!departments().length">+ قطعة جديدة</button> }
                  <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" />
      @if (departmentsLoaded() && !departments().length) {
        <p class="alert alert-warning" role="status">حسابك لا يتبع لقسم له مخزون قطع غيار.</p>
      }

      <div class="filters">
        <div class="filters-row">
          <input class="search" type="search" placeholder="بحث بالاسم أو رقم القطعة…" dir="auto"
                 [value]="searchText()" (input)="searchText.set($any($event.target).value); changed()" aria-label="بحث">
          @if (departments().length > 1) {
            <select (change)="departmentId.set(+$any($event.target).value); reload()" aria-label="القسم">
              <option [value]="0" [selected]="!departmentId()">كل الأقسام</option>
              @for (d of departments(); track d.id) { <option [value]="d.id" [selected]="d.id === departmentId()">{{ d.name }}</option> }
            </select>
          }
          @if (deviceTypes().length) {
            <select (change)="deviceTypeId.set(+$any($event.target).value); reload()" aria-label="نوع الجهاز">
              <option [value]="0" [selected]="!deviceTypeId()">كل الأجهزة</option>
              @for (t of deviceTypes(); track t.id) { <option [value]="t.id" [selected]="t.id === deviceTypeId()">تناسب {{ t.name }}</option> }
            </select>
          }
          <label class="low-toggle"><input type="checkbox" [checked]="lowOnly()" (change)="lowOnly.set($any($event.target).checked); reload()"> تحت الحد الأدنى فقط</label>
          @if (hasFilter()) { <button type="button" class="btn btn-ghost btn-sm" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>
      </div>

      <section class="panel">
        @if (loading() && !rows().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!rows().length) {
          <div class="empty-state"><h3>{{ hasFilter() ? 'لا توجد نتائج مطابقة' : 'لا توجد قطع بعد' }}</h3>
            <p>{{ hasFilter() ? 'جرّب تعديل البحث أو الفلاتر.' : 'أضف القطعة ثم «إدخال» لاستلام كمياتها.' }}</p></div>
        } @else {
          <div class="table-wrap" [class.dim]="loading()"><table>
            <thead><tr><th>القطعة</th>@if (departments().length > 1) { <th>القسم</th> }<th>الرصيد</th><th>الحد الأدنى</th><th>متوسط السعر</th><th>قيمة الرصيد</th><th>التوافق</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [class.low]="p.isLow">
                  <td><span class="cell-strong">{{ p.name }}</span>@if (p.partNumber) { <small class="mono">{{ p.partNumber }}</small> }</td>
                  @if (departments().length > 1) { <td>{{ p.departmentName }}</td> }
                  <td class="num"><span class="cell-strong">{{ p.quantity | qty }}</span> {{ p.unit }}@if (p.isLow) { <span class="low-badge">تحت الحد</span> }</td>
                  <td class="num">{{ p.minQuantity ? (p.minQuantity | qty) : '—' }}</td>
                  <td class="num">{{ p.averageCost | money }}</td>
                  <td class="num">{{ p.stockValue | money }}</td>
                  <td class="compat">{{ compat(p) }}</td>
                  <td><div class="row-actions">
                    @if (can().receiveParts) { <button class="btn btn-sm" type="button" (click)="stock.set({ part: p, mode: 'receive' })">إدخال</button> }
                    @if (can().adjustParts) { <button class="btn btn-ghost btn-sm" type="button" (click)="stock.set({ part: p, mode: 'adjust' })">تسوية</button> }
                    <button class="btn btn-ghost btn-sm" type="button" (click)="movements.set(p)">الحركات</button>
                    @if (can().editPart) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(p)">تعديل</button> }
                    @if (can().deletePart) { <button class="btn btn-danger btn-sm" type="button" (click)="remove(p)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-spare-part-form-dialog [part]="editing()" [departments]="departments()" [deviceTypes]="deviceTypes()" [companies]="companies()"
                                  (saved)="saved($event)" (closed)="formOpen.set(false)" />
    }
    @if (stock(); as s) {
      <app-spare-part-stock-dialog [part]="s.part" [mode]="s.mode" (saved)="stockSaved($event, s.mode)" (closed)="stock.set(null)" />
    }
    @if (movements(); as m) { <app-spare-part-movements [part]="m" (closed)="movements.set(null)" /> }`,
  styles: [`
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td small { display: block; color: var(--ink-500); }
    .compat { font-size: 12px; color: var(--ink-500); max-width: 220px; }
    tr.low td:first-child { box-shadow: inset -3px 0 0 var(--warning-700); }
    .low-badge { display: inline-block; margin-inline-start: 6px; padding: 1px 8px; border-radius: var(--radius-full);
      background: var(--warning-100); color: var(--warning-700); font-size: 11px; font-weight: 700; }
    .low-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap; }
    a.btn { text-decoration: none; }
  `]
})
export class MaintenanceSparePartsPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  can = this.service.can;
  pageSize = PAGE_SIZE;

  departments = signal<NamedRef[]>([]);
  departmentsLoaded = signal(false);
  deviceTypes = signal<MaintenanceLookup[]>([]);
  companies = signal<MaintenanceLookup[]>([]);

  rows = signal<SparePart[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  searchText = signal('');
  departmentId = signal(0);
  deviceTypeId = signal(0);
  lowOnly = signal(false);
  hasFilter = computed(() => !!(this.searchText().trim() || this.departmentId() || this.deviceTypeId() || this.lowOnly()));

  formOpen = signal(false);
  editing = signal<SparePart | null>(null);
  stock = signal<{ part: SparePart; mode: 'receive' | 'adjust' } | null>(null);
  movements = signal<SparePart | null>(null);

  private search$ = new Subject<void>();

  constructor() {
    this.service.partDepartments().subscribe({
      next: d => { this.departments.set(d); this.departmentsLoaded.set(true); },
      error: () => this.departmentsLoaded.set(true)
    });
    // القوائم للتوافق (تحتاج عرض قوائم الصيانة — بدونها يُخفى التوافق فقط)
    this.service.lookup('deviceTypes').subscribe({ next: l => this.deviceTypes.set(l), error: () => { } });
    this.service.lookup('companies').subscribe({ next: l => this.companies.set(l), error: () => { } });

    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());

    // من إشعار «تحت الحد الأدنى»: ?part=ID يفتح حركات القطعة
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const id = Number(p.get('part'));
      if (id) this.service.part(id).subscribe({ next: part => this.movements.set(part), error: e => this.toast.error(e.message) });
    });
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'SparePart') this.load();
    });
    this.load();
  }

  changed() { this.search$.next(); }
  reload() { this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }

  clearFilters() {
    this.searchText.set(''); this.departmentId.set(0); this.deviceTypeId.set(0); this.lowOnly.set(false);
    this.reload();
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.parts({
      search: this.searchText().trim() || undefined,
      departmentId: this.departmentId() || null,
      deviceTypeId: this.deviceTypeId() || null,
      lowStock: this.lowOnly() || undefined,
      page: this.page(), pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  compat(p: SparePart) {
    const names = [...p.deviceTypes, ...p.deviceCompanies].map(x => x.name);
    return names.length ? names.join('، ') : 'عامة';
  }

  openForm(part: SparePart | null) { this.editing.set(part); this.formOpen.set(true); }

  saved(part: SparePart) {
    this.formOpen.set(false);
    this.toast.success(this.editing() ? 'تم حفظ القطعة' : `أُضيفت «${part.name}» — استخدم «إدخال» لاستلام الكمية`);
    this.load();
  }

  stockSaved(part: SparePart, mode: 'receive' | 'adjust') {
    this.stock.set(null);
    this.toast.success(`${mode === 'receive' ? 'تم الإدخال' : 'تمت التسوية'} — الرصيد ${qty(part.quantity)} ${part.unit}`);
    this.load();
  }

  async remove(part: SparePart) {
    if (!await this.confirm.ask(`حذف «${part.name}»؟ لا تُحذف قطعة لها حركات مخزون.`, 'حذف')) return;
    this.service.deletePart(part.id).subscribe({
      next: r => { this.toast.success(r.message); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }
}
