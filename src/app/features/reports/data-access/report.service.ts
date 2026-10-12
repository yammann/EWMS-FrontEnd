import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { PagedResult } from '@core/models/paged-result.model';
import { ReportDefinition, ReportInfo, ReportLogEntry, ReportLogFilter, ReportOption, ReportPreview, ReportPrint, ReportValues } from './report.models';

/** مركز التقارير: الصلاحية وحدود السجلات يطبّقها الخادم لكل تقرير؛ Excel والطباعة يُسجَّلان في سجل السحب */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private api = inject(ApiService);

  catalog() { return this.api.get<ReportInfo[]>('/Reports/Catalog'); }
  definition(key: string) { return this.api.get<ReportDefinition>(`/Reports/Definition/${encodeURIComponent(key)}`); }
  preview(key: string, filters: ReportValues) { return this.api.post<ReportPreview>(`/Reports/Preview/${encodeURIComponent(key)}`, { filters }); }
  exportExcel(key: string, filters: ReportValues) { return this.api.postBlob(`/Reports/Export/${encodeURIComponent(key)}`, { filters }); }
  print(key: string, filters: ReportValues) { return this.api.post<ReportPrint>(`/Reports/Print/${encodeURIComponent(key)}`, { filters }); }

  log(filter: ReportLogFilter) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
    return this.api.get<PagedResult<ReportLogEntry>>(`/Reports/Log?${q}`);
  }
  logOptions() { return this.api.get<ReportOption[]>('/Reports/LogOptions'); }
}
