import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { latestRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { CONTRACT_METHODS, CONTRACT_STATUSES, ContractFilter, ContractItem } from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';

const PAGE_SIZE = 20;
type View = 'all' | 'warranty';

/**
 * العقود ضمن مشاريعي: بحث وفلتر حالة وطبيعة وترقيم من الخادم، و«ينتهي ضمانها قريباً» (مرشّح متابعة لا قرار). الصف يفتح العقد.
 * العقد يُفتح من تبويب «العقود» في إضبارة المشروع.
 */
@Component({
  selector: 'app-contracts-page', standalone: true,
  imports: [DatePipe, DecimalPipe, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './contracts-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="المشاريع" heading="العقود"
                       subtitle="عقود المشاريع وطبيعة التعاقد والمتعاقد معه والقيمة والضمان — ضمن المشاريع التي تراها">
        @if (access().canViewContractors) { <button class="btn btn-ghost" type="button" (click)="router.navigate(['/contracts/contractors'])">المقاولون</button> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <nav class="tabs" role="tablist" aria-label="عرض العقود">
          @for (v of views; track v.key) {
            <button type="button" role="tab" class="tab" [class.active]="view() === v.key" [attr.aria-selected]="view() === v.key" (click)="setView(v.key)">{{ v.label }}</button>
          }
        </nav>

        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالرقم أو المشروع أو المتعاقد معه" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          <select #mt [appSelectValue]="filter().method ?? ''" (change)="setFilter({ method: mt.value ? +mt.value : null })" aria-label="طبيعة التعاقد">
            <option value="">كل الطبائع</option>
            @for (m of methods; track m.value) { <option [value]="m.value">{{ m.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() || view() !== 'all' ? 'لا عقود مطابقة' : 'لا عقود ضمن صلاحياتك بعد — تُفتح من تبويب «العقود» في المشروع' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المشروع</th><th>الطبيعة</th><th>الحالة</th><th>المتعاقد معه</th><th>القيمة</th><th>نهاية الضمان</th></tr></thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr class="row-link" tabindex="0" (click)="open(c)" (keydown.enter)="open(c)">
                  <td class="num" dir="ltr">{{ c.number }}@if (c.officialNumber) { <small>{{ c.officialNumber }}</small> }</td>
                  <td>{{ c.projectName }}</td>
                  <td>{{ c.methodAr }}</td>
                  <td><span class="pill">{{ c.statusAr }}</span></td>
                  <td>{{ c.contractorName || '—' }}</td>
                  <td>{{ c.effectiveValue !== null ? (c.effectiveValue | number:'1.0-2') + ' ' + c.currency : '—' }}</td>
                  <td>{{ c.warrantyEnd ? (c.warrantyEnd | utc | date:'yyyy/MM/dd') : '—' }}@if (c.warrantyEndingSoon) { <small class="late">بعد {{ c.warrantyDaysLeft }} يوم</small> }</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>`
})
export class ContractsPage {
  private service = inject(ContractsService);
  readonly router = inject(Router);
  private latest = latestRequest();

  access = this.service.access;
  statuses = CONTRACT_STATUSES;
  methods = CONTRACT_METHODS;

  items = signal<ContractItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  view = signal<View>('all');
  filter = signal<ContractFilter>({ projectId: null, status: null, method: null, contractorId: null, search: '', warrantyEndingOnly: false, page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  views: { key: View; label: string }[] = [{ key: 'all', label: 'الكل' }, { key: 'warranty', label: 'ينتهي ضمانها قريباً' }];

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status || f.method); });

  constructor() { this.load(); }

  load() {
    const request: ContractFilter = { ...this.filter(), warrantyEndingOnly: this.view() === 'warranty' };
    this.latest(this.service.search(request), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setView(view: View) { this.view.set(view); this.filter.update(f => ({ ...f, page: 1 })); this.load(); }

  setFilter(patch: Partial<ContractFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null, method: null }); }
  open(c: ContractItem) { void this.router.navigate(['/contracts', c.id]); }
}
