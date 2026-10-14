import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { latestRequest } from '@shared/ui/track-request';
import { ReportService } from '../data-access/report.service';
import { ReportLogEntry, ReportOption } from '../data-access/report.models';

/**
 * سجل سحب التقارير (ViewReportLog): من سحب أي تقرير، بأي فلاتر، وكم صفاً، ومتى — Excel والطباعة، ومعها تصدير
 * صفحة التركيبات ولوحة المهام (المعاينة لا تُسجَّل). الحد في الخادم: سحوبات موظفي فرعي، والمؤسسة كلها لنظرتها.
 */
@Component({
  selector: 'app-report-log-page', standalone: true, imports: [PageHeader, Alert, EmptyState, Pager, SelectValue, DatePipe, UtcPipe],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="التقارير" heading="سجل سحب التقارير" subtitle="من نزّل أو طبع أي تقرير، بأي فلاتر، وكم صفاً، ومتى (المعاينة لا تُسجَّل)" />

      <div class="filters">
        <div class="filters-row">
          <select #r [appSelectValue]="reportKey()" (change)="reportKey.set(r.value); reload()" aria-label="التقرير">
            <option value="">كل التقارير</option>
            @for (o of reports(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
          </select>
          <input #q class="search" type="search" placeholder="اسم المستخدم" [value]="search()" aria-label="اسم المستخدم"
                 (change)="search.set(q.value.trim()); reload()" (keydown.enter)="search.set(q.value.trim()); reload()">
          <label class="period">من <input #f type="date" [value]="from()" (change)="from.set(f.value); reload()"></label>
          <label class="period">إلى <input #t type="date" [value]="to()" (change)="to.set(t.value); reload()"></label>
        </div>
      </div>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel" [attr.aria-busy]="loading()">
        @if (!items().length && !loading()) {
          <app-empty-state>لا سحوبات مسجّلة بهذه الفلاتر</app-empty-state>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>الوقت</th><th>المستخدم</th><th>التقرير</th><th>الصيغة</th><th>الفلاتر</th><th>الصفوف</th></tr></thead>
              <tbody>
                @for (l of items(); track l.id) {
                  <tr>
                    <td class="nowrap">{{ l.createdAt | utc | date:'yyyy/M/d HH:mm' }}</td>
                    <td><span class="cell-strong">{{ l.userName }}</span>@if (l.branchName) { <small>{{ l.branchName }}</small> }</td>
                    <td>{{ l.reportTitle }}</td>
                    <td><span class="pill" [class.excel]="l.format === 'Excel'">{{ l.format }}</span></td>
                    <td class="wrap">{{ l.filters }}</td>
                    <td class="num">{{ l.rowCount.toLocaleString('en-US') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [page]="page()" [pageSize]="pageSize" [total]="total()" [sizes]="[]" [disabled]="loading()" (pageChange)="page.set($event); load()" />
        }
      </section>
    </div>`,
  styles: [`
    .period { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: var(--radius-full); background: var(--fill); color: var(--ink-700); font-size: 12px; font-weight: 700; white-space: nowrap; }
    .pill.excel { background: var(--brand-50); color: var(--brand-700); }
    .wrap { min-width: 220px; max-width: 420px; font-size: 12px; color: var(--ink-600); }
  `]
})
export class ReportLogPage {
  private service = inject(ReportService);
  private latest = latestRequest();

  readonly pageSize = 20;
  reports = signal<ReportOption[]>([]);
  reportKey = signal('');
  search = signal('');
  from = signal('');
  to = signal('');
  page = signal(1);

  items = signal<ReportLogEntry[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  constructor() {
    this.service.logOptions().subscribe({ next: o => this.reports.set(o), error: () => { } });
    this.load();
  }

  reload() { this.page.set(1); this.load(); }

  load() {
    this.latest(this.service.log({
      reportKey: this.reportKey(), search: this.search(), from: this.from(), to: this.to(), page: this.page(), pageSize: this.pageSize
    }), this.loading, this.error, r => { this.items.set(r.items); this.total.set(r.totalCount); });
  }
}
