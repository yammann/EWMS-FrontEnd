import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PRINT_HEADER } from '@core/constants/print';
import { BackButton } from '@shared/ui/back-button';
import { Icon } from '@shared/ui/icon';
import { Logo } from '@shared/ui/logo';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ReportService } from '../data-access/report.service';
import { ReportPrint, ReportValues } from '../data-access/report.models';
import { columnTotal, formatCell, isNumeric, printColumns } from '../utils/report-format';

/**
 * طباعة تقرير على A4 (بالعرض للجداول العريضة): ترويسة الدولة واسم فرع الطابع، العنوان، الفلاتر ومن طبع ومتى،
 * ثم الجدول بالأعمدة الأساسية (عناوينه تتكرر في كل صفحة) وسطر «المجموع»، وترقيم الصفحات في الهامش.
 * فتح الصفحة يُسجَّل «طباعة» في سجل السحب. الحفظ PDF من نافذة طباعة المتصفح (بلا إنترنت).
 */
@Component({
  selector: 'app-report-print', standalone: true, imports: [BackButton, Icon, Logo, DatePipe, UtcPipe],
  templateUrl: './report-print-page.html',
  styleUrl: './report-print-page.scss'
})
export class ReportPrintPage {
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);

  header = PRINT_HEADER;
  data = signal<ReportPrint | null>(null);
  error = signal('');
  format = formatCell;
  numeric = isNumeric;

  columns = computed(() => printColumns(this.data()?.table.columns ?? []));
  hasSums = computed(() => this.columns().some(c => c.column.sum));
  totals = computed(() => {
    const rows = this.data()?.table.rows ?? [];
    return this.columns().map(c => c.column.sum ? formatCell(columnTotal(rows, c.index), c.column.type) : '');
  });

  constructor() {
    const key = this.route.snapshot.paramMap.get('key') ?? '';
    const query = this.route.snapshot.queryParamMap;
    const filters: ReportValues = Object.fromEntries(query.keys.map(k => [k, query.get(k) ?? '']));
    inject(ReportService).print(key, filters).subscribe({
      next: d => { this.data.set(d); if (d.landscape) this.landscapePages(); },
      error: e => this.error.set(e.message)
    });
  }

  print() { window.print(); }

  /**
   * الجداول العريضة على A4 بالعرض: قاعدة @page عامة تُضاف بعد أنماط الصفحة (فتغلب حجمها) وتُزال عند المغادرة.
   * (الصفحات المسمّاة في CSS تُخرج صفحة أولى بالطول قبلها في Chrome.)
   */
  private landscapePages() {
    const style = this.document.createElement('style');
    style.textContent = '@page { size: A4 landscape; }';
    this.document.head.appendChild(style);
    this.destroyRef.onDestroy(() => style.remove());
  }
}
