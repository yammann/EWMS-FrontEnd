import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { localDateInput } from '@core/utils/format';
import { saveBlob } from '@core/utils/download';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { PageHeader } from '@shared/ui/page-header';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { ReportService } from '../data-access/report.service';
import { ReportDefinition, ReportFilter, ReportPreview, ReportValues } from '../data-access/report.models';
import { formatCell, initialValues, isNumeric, missingRequired, setFilterValue, visibleOptions } from '../utils/report-format';

/**
 * صفحة تقرير: فلاتر يبنيها الخادم (خياراتها ضمن حدود المستخدم) ← معاينة أول الصفوف مع العدد الكلي ← Excel أو طباعة A4.
 * الفلاتر في عنوان الصفحة (?department=3…) فتبقى عند التحديث والرجوع من الطباعة. المعاينة لا تُسجَّل؛ Excel والطباعة يُسجَّلان.
 */
@Component({
  selector: 'app-report-page', standalone: true, imports: [PageHeader, Alert, EmptyState, Icon, SelectValue],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './report-page.scss'],
  templateUrl: './report-page.html'
})
export class ReportPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ReportService);
  private toast = inject(ToastService);
  private latestDefinition = latestRequest();
  private latestPreview = latestRequest();

  readonly key = this.route.snapshot.paramMap.get('key') ?? '';
  definition = signal<ReportDefinition | null>(null);
  values = signal<ReportValues>({});
  preview = signal<ReportPreview | null>(null);
  loading = signal(false);
  error = signal('');
  previewing = signal(false);
  previewError = signal('');
  exporting = signal(false);

  format = formatCell;
  numeric = isNumeric;

  missing = computed(() => { const d = this.definition(); return d ? missingRequired(d.filters, this.values()) : []; });
  missingText = computed(() => this.missing().map(f => `«${f.label}»`).join(' و'));
  total = computed(() => this.preview()?.table.total ?? 0);
  tooManyForExcel = computed(() => this.total() > (this.definition()?.maxExcelRows ?? Infinity));
  tooManyForPrint = computed(() => this.total() > (this.definition()?.maxPrintRows ?? Infinity));
  /** النتيجة الحالية تطابق الفلاتر (لا تُسحب نتيجة قديمة أثناء المعاينة) */
  ready = computed(() => !!this.preview() && !this.previewing() && !this.missing().length && this.total() > 0);

  constructor() {
    this.loadDefinition();
  }

  loadDefinition() {
    this.latestDefinition(this.service.definition(this.key), this.loading, this.error, d => {
      const query = this.route.snapshot.queryParamMap;
      const fromUrl = d.filters.filter(f => query.has(f.key));
      this.definition.set(d);
      this.values.set(fromUrl.length ? Object.fromEntries(fromUrl.map(f => [f.key, query.get(f.key) ?? ''])) : initialValues(d.filters));
      this.run();
    });
  }

  options(filter: ReportFilter) { return visibleOptions(filter, this.values()); }

  set(key: string, value: string) {
    const d = this.definition();
    if (!d) return;
    const next = setFilterValue(d.filters, this.values(), key, value.trim());
    if (JSON.stringify(next) === JSON.stringify(this.values())) return;
    this.values.set(next);
    this.syncUrl();
    this.run();
  }

  reset() {
    const d = this.definition();
    if (!d) return;
    this.values.set(initialValues(d.filters));
    this.syncUrl();
    this.run();
  }

  private syncUrl() {
    this.router.navigate([], { relativeTo: this.route, queryParams: this.values(), replaceUrl: true });
  }

  run() {
    if (!this.definition() || this.missing().length) { this.preview.set(null); return; }
    this.latestPreview(this.service.preview(this.key, this.values()), this.previewing, this.previewError, p => this.preview.set(p));
  }

  exportExcel() {
    const d = this.definition();
    if (!d || !this.ready() || this.tooManyForExcel()) return;
    this.exporting.set(true);
    this.service.exportExcel(this.key, this.values()).subscribe({
      next: blob => { this.exporting.set(false); saveBlob(blob, `${d.title} ${localDateInput()}.xlsx`); this.toast.success('نُزّل الملف وسُجّل السحب'); },
      error: e => { this.exporting.set(false); this.toast.error(e.message); }
    });
  }

  openPrint() {
    if (!this.ready() || this.tooManyForPrint()) return;
    this.router.navigate(['/reports/print', this.key], { queryParams: this.values() });
  }
}
