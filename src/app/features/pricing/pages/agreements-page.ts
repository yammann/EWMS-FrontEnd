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
import { AGREEMENT_STATUSES, AgreementFilter, AgreementInput, AgreementListItem } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { AgreementFormDialog } from '../components/agreement-form-dialog';

const PAGE_SIZE = 20;

/** محاضر الاتفاق مع المتعهدين الجدد: الإعداد لمدير المكتب (PreparePricingAgreement) والاعتماد لغير من أعدّ. بحث وفلتر حالة وترقيم من الخادم. */
@Component({
  selector: 'app-agreements-page', standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, AgreementFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="مكتب التسعير" heading="محاضر الاتفاق"
                       subtitle="محاضر الاتفاق مع المتعهدين الجدد: تُعدّ مسوّدة ثم تُرسل للاعتماد من غير من أعدّها">
        @if (access().canView) { <a class="btn btn-ghost" routerLink="/pricing">طلبات التسعير</a> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        @if (access().canPrepareAgreement) { <button class="btn" type="button" (click)="dialog.set(true)">+ محضر اتفاق</button> }
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالرقم أو المتعهد أو المشروع" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() ? 'لا محاضر مطابقة' : 'لا محاضر اتفاق ضمن صلاحياتك بعد' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المتعهد</th><th>المشروع</th><th>الحالة</th><th>الإجمالي</th><th>أعدّه</th><th>التاريخ</th></tr></thead>
            <tbody>
              @for (a of items(); track a.id) {
                <tr class="row-link" tabindex="0" (click)="open(a.id)" (keydown.enter)="open(a.id)">
                  <td class="num" dir="ltr">{{ a.internalNumber }}@if (a.number) { <small>{{ a.number }}</small> }</td>
                  <td>{{ a.supplierName }}</td>
                  <td>{{ a.projectName || '—' }}</td>
                  <td><span class="pill">{{ a.statusAr }}</span></td>
                  <td>{{ a.total | number:'1.0-2' }} {{ a.currency }}</td>
                  <td>{{ a.preparedByName }}</td>
                  <td>{{ a.agreementDate | utc | date:'yyyy/MM/dd' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>

    @if (dialog()) {
      <app-pricing-agreement-form-dialog [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class AgreementsPage {
  private service = inject(PricingService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  statuses = AGREEMENT_STATUSES;
  items = signal<AgreementListItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  filter = signal<AgreementFilter>({ branchId: null, status: null, supplierId: null, search: '', page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status); });

  constructor() { this.load(); }

  load() {
    this.latest(this.service.searchAgreements(this.filter()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setFilter(patch: Partial<AgreementFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null }); }
  open(id: number) { void this.router.navigate(['/pricing/agreements', id]); }

  create(input: AgreementInput) {
    trackRequest(this.service.createAgreement(input), this.saving, this.formError, a => {
      this.dialog.set(false); this.toast.success('حُفظ محضر الاتفاق كمسوّدة');
      this.open(a.id);
    });
  }
}
