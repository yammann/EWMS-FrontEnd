/** مركز التقارير — نماذج مطابقة لـ ReportResponseDtos في الباكاند */
export type ReportColumnType = 'text' | 'number' | 'decimal' | 'money' | 'date' | 'datetime';
export type ReportFilterType = 'date' | 'select' | 'text' | 'number';
export type ReportCell = string | number | null;

export interface ReportColumn { key: string; header: string; type: ReportColumnType; print: boolean; sum: boolean; }
export interface ReportTable { columns: ReportColumn[]; rows: ReportCell[][]; total: number; }

export interface ReportOption { value: string; label: string; parent: string | null; }
export interface ReportFilter {
  key: string; label: string; type: ReportFilterType; required: boolean;
  /** فلتر أب: تظهر من الخيارات ما يطابق parent قيمته المختارة */
  dependsOn: string | null;
  default: string | null; hint: string | null;
  options: ReportOption[];
}

export interface ReportInfo { key: string; title: string; group: string; description: string; landscape: boolean; }
export interface ReportDefinition extends ReportInfo {
  filters: ReportFilter[];
  previewRows: number; maxExcelRows: number; maxPrintRows: number;
}

export interface ReportPreview { filtersText: string; table: ReportTable; }
export interface ReportPrint {
  key: string; title: string; landscape: boolean; branchName: string;
  filtersText: string; printedBy: string; printedAt: string; table: ReportTable;
}

/** قيم الفلاتر: المفتاح ← القيمة (التاريخ yyyy-MM-dd) */
export type ReportValues = Record<string, string>;

export interface ReportLogEntry {
  id: number; userId: number; userName: string; branchName: string;
  reportKey: string; reportTitle: string; format: string; filters: string; rowCount: number; createdAt: string;
}
export interface ReportLogFilter { reportKey?: string; search?: string; from?: string; to?: string; page: number; pageSize: number; }
