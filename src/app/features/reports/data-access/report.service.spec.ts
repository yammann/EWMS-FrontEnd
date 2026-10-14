import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { ReportService } from './report.service';
import { ReportFilter } from './report.models';
import { columnTotal, formatCell, initialValues, missingRequired, printColumns, setFilterValue, visibleOptions } from '../utils/report-format';

const filter = (key: string, extra: Partial<ReportFilter> = {}): ReportFilter =>
  ({ key, label: key, type: 'select', required: false, dependsOn: null, default: null, hint: null, options: [], ...extra });

describe('Reports center', () => {
  let service: ReportService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(ReportService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends the filters in the body and the log filters in the query string', () => {
    service.preview('vacations', { from: '2026-01-01', department: '3' }).subscribe();
    const preview = http.expectOne('/api/Reports/Preview/vacations');
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({ filters: { from: '2026-01-01', department: '3' } });
    preview.flush({ filtersText: '', table: { columns: [], rows: [], total: 0 } });

    service.exportExcel('users', {}).subscribe();
    const file = http.expectOne('/api/Reports/Export/users');
    expect(file.request.responseType).toBe('blob');
    file.flush(new Blob(['x']));

    service.log({ reportKey: 'users', search: '', page: 2, pageSize: 20 }).subscribe();
    http.expectOne('/api/Reports/Log?reportKey=users&page=2&pageSize=20').flush({ items: [], totalCount: 0, page: 2, pageSize: 20, totalPages: 0 });
  });

  it('shows the server message of a failed file download (JSON inside the Blob)', async () => {
    const message = new Promise<string>(resolve => service.exportExcel('users', {}).subscribe({ error: e => resolve(e.message) }));
    http.expectOne('/api/Reports/Export/users').flush(new Blob([JSON.stringify({ message: 'ضيّق الفلاتر' })], { type: 'application/json' }),
      { status: 400, statusText: 'Bad Request' });
    expect(await message).toBe('ضيّق الفلاتر');
  });

  it('shows only the children of the chosen parent and clears a child that no longer fits', () => {
    const filters = [
      filter('branch', { options: [{ value: '1', label: 'أ', parent: null }, { value: '2', label: 'ب', parent: null }] }),
      filter('department', { dependsOn: 'branch', options: [{ value: '10', label: 'قسم أ', parent: '1' }, { value: '20', label: 'قسم ب', parent: '2' }] })
    ];
    expect(visibleOptions(filters[1], {}).length).toBe(2);
    expect(visibleOptions(filters[1], { branch: '2' }).map(o => o.value)).toEqual(['20']);

    let values = setFilterValue(filters, {}, 'department', '10');
    values = setFilterValue(filters, values, 'branch', '1');
    expect(values).toEqual({ branch: '1', department: '10' });     // القسم يتبع الفرع: يبقى
    values = setFilterValue(filters, values, 'branch', '2');
    expect(values).toEqual({ branch: '2' });                       // لا يتبع الفرع الجديد: يُمسح
    expect(setFilterValue(filters, values, 'branch', '')).toEqual({});
  });

  it('starts from the defaults and lists the required filters still empty', () => {
    const filters = [filter('from', { type: 'date', default: '2026-01-01' }), filter('layer', { required: true })];
    expect(initialValues(filters)).toEqual({ from: '2026-01-01' });
    expect(missingRequired(filters, initialValues(filters)).map(f => f.key)).toEqual(['layer']);
  });

  it('formats cells by column type, sums a column and keeps the print columns with their index', () => {
    expect(formatCell('2026-03-01T00:00:00', 'date')).toBe('2026-03-01');
    expect(formatCell(1500.5, 'money')).toBe('1,501');
    expect(formatCell(2.456, 'decimal')).toBe('2.46');
    expect(formatCell(12000, 'number')).toBe('12,000');
    expect(formatCell(null, 'text')).toBe('');
    expect(columnTotal([[1, 'x'], [2.5, null], [null, 'y']], 0)).toBe(3.5);
    const cols = printColumns([
      { key: 'c0', header: 'أ', type: 'text', print: true, sum: false },
      { key: 'c1', header: 'ب', type: 'text', print: false, sum: false },
      { key: 'c2', header: 'ج', type: 'number', print: true, sum: true }
    ]);
    expect(cols.map(c => c.index)).toEqual([0, 2]);
  });
});
