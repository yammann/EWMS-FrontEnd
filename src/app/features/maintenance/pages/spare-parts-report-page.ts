import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NamedRef, SparePartReport } from '../data-access/spare-part.models';
import { StatTile } from '@shared/ui/stat-tile';
import { MoneyPipe, QtyPipe } from '@shared/pipes/format.pipes';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { latestRequest } from '@shared/ui/track-request';

/**
 * تقارير قطع الغيار (قرار المستخدم 2026-10-05 — بلا نسب التكلفة للأقسام): قيمة المخزون، أكثر القطع صرفاً في الفترة،
 * وأعلى الأجهزة تكلفة على مدى عمرها مع تنبيه «إصلاحه أغلى من استبداله» حسب حد نوع الجهاز.
 */
@Component({
  selector: 'app-spare-parts-report-page', standalone: true, imports: [PageHeader, EmptyState, Alert, QtyPipe, MoneyPipe, RouterLink, StatTile],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss', './requests-page.scss'],
  templateUrl: './spare-parts-report-page.html',
  styles: [`
    .period { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td small { display: block; color: var(--ink-500); }
    a.btn { text-decoration: none; }
  `]
})
export class MaintenanceSparePartsReportPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(MaintenanceService);
  can = this.service.can;

  today = localDateInput(new Date());
  from = signal(localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  to = signal(this.today);
  departmentId = signal(0);
  departments = signal<NamedRef[]>([]);

  report = signal<SparePartReport | null>(null);
  loading = signal(false);
  error = signal('');

  constructor() {
    if (this.can().viewParts) this.service.partDepartments().subscribe({ next: d => this.departments.set(d), error: () => { } });
    this.load();
  }

  load() {
    this.latest(this.service.partReport({ departmentId: this.departmentId() || null, from: this.from(), to: this.to() }), this.loading, this.error, r => { this.report.set(r); });
  }
}
