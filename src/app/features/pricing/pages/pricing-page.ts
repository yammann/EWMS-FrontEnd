import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { PRICING_STATUSES, PricingFilter, PricingListItem, PricingRequestInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { RequestFormDialog } from '../components/request-form-dialog';

const PAGE_SIZE = 20;
type View = 'all' | 'mine' | 'overdue';

/**
 * طلبات التسعير: «كلها» ضمن حدّ الفرع، و«طلباتي» (ما سجّلته أو كُلِّفت به)، و«المتأخرة» (تجاوزت موعدها ولم تنتهِ — تنبيه لا قرار).
 * بحث وفلتر حالة وترقيم من الخادم. التسجيل لمن يملك صلاحيته.
 */
@Component({
  selector: 'app-pricing-page', standalone: true,
  imports: [DatePipe, RouterLink, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, RequestFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="المشاريع" heading="مكتب التسعير"
                       subtitle="طلبات التسعير وعروض الموردين ومقارنتها بنداً بنداً — لا اختيار آلي للأرخص، والقرار لمن يملكه">
        @if (access().canViewAgreements) { <a class="btn btn-ghost" routerLink="/pricing/agreements">محاضر الاتفاق</a> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        @if (access().canRegister) { <button class="btn" type="button" (click)="dialog.set(true)">+ طلب تسعير</button> }
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <nav class="tabs" role="tablist" aria-label="عرض الطلبات">
          @for (v of views; track v.key) {
            <button type="button" role="tab" class="tab" [class.active]="view() === v.key" [attr.aria-selected]="view() === v.key" (click)="setView(v.key)">{{ v.label }}</button>
          }
        </nav>

        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالرقم أو العنوان أو المشروع" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() || view() !== 'all' ? 'لا طلبات مطابقة' : 'لا طلبات تسعير ضمن صلاحياتك بعد' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>العنوان</th><th>المشروع</th><th>الحالة</th><th>المكلَّف</th><th>البنود / العروض</th><th>الموعد</th></tr></thead>
            <tbody>
              @for (r of items(); track r.id) {
                <tr class="row-link" tabindex="0" (click)="open(r.id)" (keydown.enter)="open(r.id)">
                  <td class="num" dir="ltr">{{ r.number }}</td>
                  <td>{{ r.title }}@if (r.outsideContractScope) { <small>خارج نطاق العقد</small> }</td>
                  <td>{{ r.projectName || '—' }}</td>
                  <td><span class="pill">{{ r.statusAr }}</span></td>
                  <td>{{ r.assigneeName || '—' }}</td>
                  <td>{{ r.itemsCount }} / {{ r.offersCount }}</td>
                  <td>{{ r.dueDate ? (r.dueDate | utc | date:'yyyy/MM/dd') : '—' }}@if (r.isOverdue) { <small class="late">متأخر</small> }</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>

    @if (dialog()) {
      <app-pricing-request-form-dialog [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class PricingPage {
  private service = inject(PricingService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private latest = latestRequest();

  access = this.service.access;
  statuses = PRICING_STATUSES;
  items = signal<PricingListItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  view = signal<View>('all');
  filter = signal<PricingFilter>({ branchId: null, projectId: null, status: null, search: '', overdueOnly: false, mine: false, page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;
  views: { key: View; label: string }[] = [{ key: 'all', label: 'الكل' }, { key: 'mine', label: 'طلباتي' }, { key: 'overdue', label: 'المتأخرة' }];

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status || f.projectId); });

  constructor() {
    const projectId = Number(this.route.snapshot.queryParamMap.get('projectId'));
    if (projectId) this.filter.update(f => ({ ...f, projectId }));
    this.load();
  }

  load() {
    const request: PricingFilter = { ...this.filter(), mine: this.view() === 'mine', overdueOnly: this.view() === 'overdue' };
    this.latest(this.service.search(request), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setView(view: View) { this.view.set(view); this.filter.update(f => ({ ...f, page: 1 })); this.load(); }

  setFilter(patch: Partial<PricingFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null, projectId: null }); }
  open(id: number) { void this.router.navigate(['/pricing', id]); }

  create(input: PricingRequestInput) {
    trackRequest(this.service.create(input), this.saving, this.formError, r => {
      this.dialog.set(false); this.toast.success('سُجّل طلب التسعير');
      this.open(r.id);
    });
  }
}
