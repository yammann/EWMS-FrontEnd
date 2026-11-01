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
import { RECONCILIATION_STATUSES, ReconciliationFilter, ReconciliationInput, ReconciliationItem } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { ReconciliationFormDialog } from '../components/reconciliation-form-dialog';

const PAGE_SIZE = 20;

/** مطابقة الفواتير والكشوف الواردة مع الأسعار المعتمدة والمرجعية: النظام يقارن ويقترح ولا يقرر؛ المدقق يسجّل النتيجة وغيره يعتمد. */
@Component({
  selector: 'app-reconciliations-page', standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, ReconciliationFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="مكتب التسعير" heading="مطابقة الفواتير والكشوف"
                       subtitle="مقارنة المستندات الواردة من القسم المالي مع الأسعار المعتمدة بنداً بنداً — الفروق تُوثَّق ولا تُحكم آلياً">
        @if (access().canView) { <a class="btn btn-ghost" routerLink="/pricing">طلبات التسعير</a> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        @if (access().canPrepareReconciliation) { <button class="btn" type="button" (click)="dialog.set(true)">+ مستند وارد</button> }
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث برقم المستند أو المورد أو المشروع" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() ? 'لا مطابقات مطابقة' : 'لا مطابقات ضمن صلاحياتك بعد' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المستند</th><th>المورد</th><th>المشروع</th><th>الإجمالي</th><th>الحالة</th><th>دقّقه</th><th>التاريخ</th></tr></thead>
            <tbody>
              @for (r of items(); track r.id) {
                <tr class="row-link" tabindex="0" (click)="open(r.id)" (keydown.enter)="open(r.id)">
                  <td class="num" dir="ltr">{{ r.number }}</td>
                  <td>{{ r.documentKindAr }} <span dir="ltr">{{ r.documentNumber }}</span><small>عدد البنود: {{ r.linesCount }}</small></td>
                  <td>{{ r.supplierName }}</td>
                  <td>{{ r.projectName || '—' }}</td>
                  <td>{{ r.total | number:'1.0-2' }} {{ r.currency }}</td>
                  <td><span class="pill">{{ r.statusAr }}</span></td>
                  <td>{{ r.preparedByName }}</td>
                  <td>{{ r.documentDate | utc | date:'yyyy/MM/dd' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>

    @if (dialog()) {
      <app-reconciliation-form-dialog [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class ReconciliationsPage {
  private service = inject(PricingService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  statuses = RECONCILIATION_STATUSES;
  items = signal<ReconciliationItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  filter = signal<ReconciliationFilter>({ branchId: null, status: null, supplierId: null, projectId: null, search: '', page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status); });

  constructor() { this.load(); }

  load() {
    this.latest(this.service.searchReconciliations(this.filter()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setFilter(patch: Partial<ReconciliationFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null }); }
  open(id: number) { void this.router.navigate(['/pricing/reconciliations', id]); }

  create(input: ReconciliationInput) {
    trackRequest(this.service.createReconciliation(input), this.saving, this.formError, r => {
      this.dialog.set(false); this.toast.success('حُفظ المستند كمسودة');
      this.open(r.id);
    });
  }
}
