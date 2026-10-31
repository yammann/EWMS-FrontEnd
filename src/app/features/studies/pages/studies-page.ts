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
import { STUDY_STATUSES, StudyFilter, StudyItem } from '../data-access/studies.models';
import { StudiesService } from '../data-access/studies.service';

const PAGE_SIZE = 20;
type View = 'all' | 'mine' | 'overdue';

/**
 * أوامر الدراسة: «ما أُسند إليّ» (مخرجات أعدّها)، والكل ضمن مشاريعي، والتي فيها مخرج متأخر — بحدّ رؤية المشاريع.
 * بحث وفلتر حالة وترقيم من الخادم. الصف يفتح الأمر. الأمر يُفتح من تبويب «الدراسة» في إضبارة المشروع.
 */
@Component({
  selector: 'app-studies-page', standalone: true,
  imports: [DatePipe, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './studies-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="المشاريع" heading="الدراسات"
                       subtitle="أوامر الدراسة ومخرجات المكاتب الفنية وإرسالها إلى المركزية — ضمن المشاريع التي تراها">
        @if (access().canManageTypes || access().canViewTypes) { <button class="btn btn-ghost" type="button" (click)="router.navigate(['/studies/types'])">أنواع المخرجات</button> }
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        <nav class="tabs" role="tablist" aria-label="عرض الدراسات">
          @for (v of views; track v.key) {
            <button type="button" role="tab" class="tab" [class.active]="view() === v.key" [attr.aria-selected]="view() === v.key" (click)="setView(v.key)">{{ v.label }}</button>
          }
        </nav>

        <div class="toolbar">
          <input #q class="search" type="search" placeholder="بحث بالعنوان أو المشروع أو رقم الأمر" [value]="filter().search" (input)="typing(q.value)" aria-label="بحث">
          <select #st [appSelectValue]="filter().status ?? ''" (change)="setFilter({ status: st.value ? +st.value : null })" aria-label="الحالة">
            <option value="">كل الحالات</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          @if (hasFilters()) { <button type="button" class="btn btn-ghost" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>

        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length && !error()) { <app-empty-state>{{ hasFilters() || view() !== 'all' ? 'لا أوامر دراسة مطابقة' : 'لا أوامر دراسة ضمن صلاحياتك بعد — تُفتح من تبويب «الدراسة» في المشروع' }}</app-empty-state> }
        @else if (items().length) {
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>العنوان</th><th>المشروع</th><th>الحالة</th><th>المخرجات</th><th>الموعد</th><th>فُتح</th></tr></thead>
            <tbody>
              @for (s of items(); track s.id) {
                <tr class="row-link" tabindex="0" (click)="open(s)" (keydown.enter)="open(s)">
                  <td class="num" dir="ltr">{{ s.number }}</td>
                  <td><span class="cell-strong">{{ s.title }}</span>@if (s.externalNumber) { <small dir="ltr">{{ s.externalNumber }}</small> }</td>
                  <td>{{ s.projectName }}</td>
                  <td><span class="pill" [class.pill-late]="s.isOverdue">{{ s.statusAr }}</span>@if (s.isOverdue) { <small class="late">فيه مخرج متأخر</small> }</td>
                  <td>{{ s.deliverablesApproved }} / {{ s.deliverablesTotal }}<small>{{ s.modeAr }}</small></td>
                  <td>{{ s.dueDate ? (s.dueDate | utc | date:'yyyy/MM/dd') : '—' }}</td>
                  <td>{{ s.createdAt | utc | date:'yyyy/MM/dd' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="filter().page" [pageSize]="filter().pageSize" [total]="total()" (pageChange)="setFilter({ page: $event })" />
        }
      </section>
    </div>`
})
export class StudiesPage {
  private service = inject(StudiesService);
  readonly router = inject(Router);
  private latest = latestRequest();

  access = this.service.access;
  statuses = STUDY_STATUSES;

  items = signal<StudyItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  /** «ما أُسند إليّ» الافتراضي لمن يعدّ المخرجات، وإلا الكل */
  view = signal<View>(this.service.access().canPrepare ? 'mine' : 'all');
  filter = signal<StudyFilter>({ projectId: null, status: null, search: '', overdueOnly: false, mine: false, page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  views: { key: View; label: string }[] = [{ key: 'mine', label: 'أُسند إليّ' }, { key: 'all', label: 'الكل' }, { key: 'overdue', label: 'فيها متأخر' }];

  hasFilters = computed(() => { const f = this.filter(); return !!(f.search || f.status); });

  constructor() { this.load(); }

  private request(): StudyFilter {
    const v = this.view();
    return { ...this.filter(), mine: v === 'mine', overdueOnly: v === 'overdue' };
  }

  load() {
    this.latest(this.service.search(this.request()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setView(view: View) { this.view.set(view); this.filter.update(f => ({ ...f, page: 1 })); this.load(); }

  setFilter(patch: Partial<StudyFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  clearFilters() { this.setFilter({ search: '', status: null }); }
  open(s: StudyItem) { void this.router.navigate(['/studies', s.id]); }
}
