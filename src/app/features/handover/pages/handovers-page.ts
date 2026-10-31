import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { latestRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { HANDOVER_KINDS, HANDOVER_STATUSES, HandoverFilter, HandoverItem } from '../data-access/handover.models';
import { HandoverService } from '../data-access/handover.service';

const PAGE_SIZE = 20;
type View = 'all' | 'notes';

/**
 * محاضر الاستلام ضمن مشاريعي: أولي ونهائي، و«فيها ملاحظات لم تُغلق» (مرشّح متابعة لا قرار). بحث وفلتر نوع وحالة وترقيم من الخادم.
 * يُقدَّم الطلب من تبويب «الاستلام» في إضبارة المشروع.
 */
@Component({
  selector: 'app-handovers-page', standalone: true,
  imports: [DatePipe, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './handovers-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="المشاريع" heading="الاستلام والتسليم"
                       subtitle="طلبات الاستلام (أولي ونهائي) ولجانها ونتائجها وملاحظاتها — ضمن المشاريع التي تراها">
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <nav class="tabs" role="tablist" aria-label="عرض المحاضر">
          @for (v of views; track v.key) {
            <button type="button" role="tab" class="tab" [class.active]="view() === v.key" [attr.aria-selected]="view() === v.key" (click)="setView(v.key)">{{ v.label }}</button>
          }
        </nav>

        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالمشروع أو رقم العقد" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #k [appSelectValue]="filter().kind ?? ''" (change)="setFilter({ kind: k.value ? +k.value : null })" aria-label="النوع">
            <option value="">أولي ونهائي</option>
            @for (x of kinds; track x.value) { <option [value]="x.value">{{ x.label }}</option> }
          </select>
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() || view() !== 'all' ? 'لا محاضر مطابقة' : 'لا محاضر استلام ضمن صلاحياتك بعد — يُقدَّم الطلب من تبويب «الاستلام» في المشروع' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المشروع</th><th>النوع</th><th>الحالة</th><th>النتيجة</th><th>الملاحظات</th><th>الطلب</th></tr></thead>
            <tbody>
              @for (h of items(); track h.id) {
                <tr class="row-link" tabindex="0" (click)="open(h)" (keydown.enter)="open(h)">
                  <td class="num" dir="ltr">{{ h.number }}@if (h.contractNumber) { <small>{{ h.contractNumber }}</small> }</td>
                  <td>{{ h.projectName }}</td>
                  <td>{{ h.kindAr }}</td>
                  <td><span class="pill">{{ h.statusAr }}</span></td>
                  <td>{{ h.resultAr || '—' }}</td>
                  <td>{{ h.openNotes }} / {{ h.totalNotes }}@if (h.hasOverdueNote) { <small class="late">فيها ملاحظة متأخرة</small> }</td>
                  <td>{{ h.requestedAt | utc | date:'yyyy/MM/dd' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>`
})
export class HandoversPage {
  private service = inject(HandoverService);
  readonly router = inject(Router);
  private latest = latestRequest();

  kinds = HANDOVER_KINDS;
  statuses = HANDOVER_STATUSES;
  items = signal<HandoverItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  view = signal<View>('all');
  filter = signal<HandoverFilter>({ projectId: null, kind: null, status: null, search: '', openNotesOnly: false, page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;
  views: { key: View; label: string }[] = [{ key: 'all', label: 'الكل' }, { key: 'notes', label: 'فيها ملاحظات مفتوحة' }];

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.kind || f.status); });

  constructor() { this.load(); }

  load() {
    const request: HandoverFilter = { ...this.filter(), openNotesOnly: this.view() === 'notes' };
    this.latest(this.service.search(request), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setView(view: View) { this.view.set(view); this.filter.update(f => ({ ...f, page: 1 })); this.load(); }

  setFilter(patch: Partial<HandoverFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', kind: null, status: null }); }
  open(h: HandoverItem) { void this.router.navigate(['/handovers', h.id]); }
}
