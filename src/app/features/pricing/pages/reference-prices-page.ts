import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { REFERENCE_STATUSES, ReferencePriceFilter, ReferencePriceInput, ReferencePriceItem } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { ReferencePriceFormDialog, ReferencePriceSubmit } from '../components/reference-price-form-dialog';

const PAGE_SIZE = 20;

/**
 * الأسعار المرجعية: سجل تاريخي لأسعار المواد عند الموردين بمصدرها وتاريخها (لا يُعدَّل؛ التصحيح بسجل بديل).
 * «آخر سعر» الأحدث تاريخاً لمادة بوحدة وعملة واحدة — ليس الأرخص ولا الأغلى؛ ولا مقارنة بين وحدات أو عملات مختلفة.
 * بحث وفلتر حالة وفترة وترقيم من الخادم؛ والمُستبدَل مخفي ما لم يُطلب.
 */
@Component({
  selector: 'app-reference-prices-page', standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, ReferencePriceFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="مكتب التسعير" heading="الأسعار المرجعية"
                       subtitle="أسعار المواد عند الموردين بمصدرها وتاريخها — سجل لا يُعدَّل، والتصحيح بسجل بديل، والمعتمد للاستخدام الحالي غير التاريخي">
        @if (access().canView) { <a class="btn btn-ghost" routerLink="/pricing">طلبات التسعير</a> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        @if (access().canAddReferencePrice) { <button class="btn" type="button" (click)="dialog.set(true)">+ سعر مرجعي</button> }
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالرمز أو المادة أو المورد أو المصدر" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">غير المُستبدَل</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          <label class="check"><input type="checkbox" [checked]="filter().includeSuperseded" (change)="setFilter({ includeSuperseded: $any($event.target).checked })"> أظهر المُستبدَل</label>
          <input #f class="date" type="date" [value]="filter().from" (change)="setFilter({ from: f.value })" aria-label="من تاريخ">
          <input #t class="date" type="date" [value]="filter().to" (change)="setFilter({ to: t.value })" aria-label="إلى تاريخ">
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() ? 'لا أسعار مطابقة' : 'لا أسعار مرجعية ضمن صلاحياتك بعد' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المادة</th><th>المورد</th><th>سعر الوحدة</th><th>التاريخ</th><th>المصدر</th><th>الحالة</th></tr></thead>
            <tbody>
              @for (p of items(); track p.id) {
                <tr class="row-link" tabindex="0" (click)="open(p.id)" (keydown.enter)="open(p.id)">
                  <td class="num" dir="ltr">{{ p.number }}</td>
                  <td>{{ p.itemName }}@if (p.itemCode) { <small dir="ltr">{{ p.itemCode }}</small> }</td>
                  <td>{{ p.supplierName }}</td>
                  <td>{{ p.unitPrice | number:'1.0-4' }} {{ p.currency }} / {{ p.unit }}</td>
                  <td>{{ p.priceDate | utc | date:'yyyy/MM/dd' }}@if (p.isLatest) { <small class="latest">آخر سعر</small> } @else if (p.isLatestForSupplier) { <small>آخر سعر لهذا المورد</small> }</td>
                  <td>{{ p.sourceDocument }}<small>{{ p.sourceAr }}</small></td>
                  <td><span class="pill">{{ p.statusAr }}</span></td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>

    @if (dialog()) {
      <app-reference-price-form-dialog [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class ReferencePricesPage {
  private service = inject(PricingService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  statuses = REFERENCE_STATUSES;
  items = signal<ReferencePriceItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  filter = signal<ReferencePriceFilter>({ branchId: null, search: '', supplierId: null, projectId: null, status: null, includeSuperseded: false, from: '', to: '', page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status || f.includeSuperseded || f.from || f.to); });

  constructor() { this.load(); }

  load() {
    this.latest(this.service.searchReferencePrices(this.filter()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setFilter(patch: Partial<ReferencePriceFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null, includeSuperseded: false, from: '', to: '' }); }
  open(id: number) { void this.router.navigate(['/pricing/reference-prices', id]); }

  create(input: ReferencePriceSubmit) {
    trackRequest(this.service.createReferencePrice(input as ReferencePriceInput), this.saving, this.formError, p => {
      this.dialog.set(false); this.toast.success('أُضيف السعر المرجعي وينتظر الاعتماد');
      this.open(p.id);
    });
  }
}
