import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceRequest } from '../data-access/maintenance.models';
import { utcDate } from '@core/utils/format';
import { daysAr, timesAr } from '@core/utils/arabic-count';
import { StatusChip } from './maintenance-ui';
import { UtcPipe } from '@shared/pipes/format.pipes';

/** أقصى عدد يُعرض بعد «عرض الكل» */
const FULL_SIZE = 100;

/**
 * سجل إصلاحات جهاز صيانة (MaintenanceRequests/GetAll?deviceMaintenanceId= — محصور بنطاق الطلبات للمستخدم).
 * مشترك بين صفحة طلب الصيانة (يستثني الطلب المفتوح، آخر 10 + «عرض الكل») ونافذة سجل الجهاز في صفحة الأجهزة.
 */
@Component({
  selector: 'app-device-repair-history', standalone: true, imports: [UtcPipe, DatePipe, RouterLink, StatusChip],
  template: `
    @if (loading() && !items().length) { <p class="muted" role="status">جارٍ تحميل السجل…</p> }
    @else if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
    @else {
      <p class="summary">{{ summary() }}</p>
      @if (items().length) {
        <div class="table-wrap" [class.dim]="loading()"><table>
          <thead><tr><th>رقم الطلب</th><th>تاريخ الاستلام</th><th>العميل</th><th>العطل</th><th>الحالة</th><th>الفني</th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr>
                <td><a class="number mono" [routerLink]="['/maintenance/requests', r.id]" (click)="navigated.emit()">{{ r.number }}</a></td>
                <td class="nowrap">{{ r.createdAt | utc | date:'yyyy/MM/dd' }}</td>
                <td>{{ r.clientName }}</td>
                <td>{{ r.damageTypeName }}</td>
                <td><app-status-chip [name]="r.statusName" [color]="r.statusColor" /></td>
                <td>{{ r.technicianName }}</td>
              </tr>
            }
          </tbody>
        </table></div>
        @if (hiddenCount() > 0) {
          <div class="more">
            @if (!expanded()) { <button type="button" class="btn btn-ghost btn-sm" (click)="expanded.set(true)" [disabled]="loading()">عرض الكل ({{ others() }})</button> }
            @else { <span class="muted">يُعرض أحدث {{ items().length }} من {{ others() }}.</span> }
          </div>
        }
      }
    }`,
  styles: [`
    .summary { margin: 0 0 10px; font-size: 13px; color: var(--ink-600); }
    .muted { color: var(--ink-500); font-size: 13px; }
    .more { display: flex; justify-content: center; margin-top: 10px; }
    .dim { opacity: .6; }
  `]
})
export class DeviceRepairHistory {
  private service = inject(MaintenanceService);

  deviceId = input.required<number>();
  /** الطلب المفتوح حالياً — لا يُعرض في سجله */
  excludeRequestId = input<number | null>(null);
  /** عدد الطلبات قبل «عرض الكل» */
  limit = input(10);
  /** عند الانتقال إلى طلب (لإغلاق نافذة مثلاً) */
  navigated = output<void>();

  expanded = signal(false);
  loading = signal(false);
  error = signal('');
  private result = signal<{ items: MaintenanceRequest[]; total: number }>({ items: [], total: 0 });

  /** الطلبات الأخرى للجهاز (بلا الطلب المفتوح) */
  items = computed(() => {
    const exclude = this.excludeRequestId();
    const list = this.result().items.filter(r => r.id !== exclude);
    return this.expanded() ? list : list.slice(0, this.limit());
  });
  others = computed(() => {
    const exclude = this.excludeRequestId();
    const r = this.result();
    return r.total - (exclude && r.items.some(x => x.id === exclude) ? 1 : 0);
  });
  hiddenCount = computed(() => this.others() - this.items().length);

  summary = computed(() => {
    const others = this.others();
    const withCurrent = others + (this.excludeRequestId() ? 1 : 0);
    if (!others) return this.excludeRequestId() ? 'أول مرة يدخل هذا الجهاز الصيانة.' : 'لا توجد طلبات صيانة لهذا الجهاز ضمن ما تستطيع رؤيته.';
    const latest = this.items()[0];
    const date = latest ? utcDate(latest.createdAt) : null;
    const days = date ? Math.floor((Date.now() - date.getTime()) / 86_400_000) : null;
    const ago = days === null ? '' : days <= 0 ? ' — أحدث طلب آخر اليوم' : ` — أحدث طلب آخر قبل ${daysAr(days)}`;
    return `دخل هذا الجهاز الصيانة ${timesAr(withCurrent)}${this.excludeRequestId() ? ' (مع هذا الطلب)' : ''}${ago}.`;
  });

  constructor() {
    combineLatest([toObservable(this.deviceId), toObservable(this.expanded)]).pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      // طلب واحد إضافي يعوّض الطلب المستثنى
      switchMap(([deviceId, expanded]) => this.service.requests({ deviceMaintenanceId: deviceId, page: 1, pageSize: expanded ? FULL_SIZE : this.limit() + 1 }).pipe(
        map(r => ({ items: r.items, total: r.totalCount, error: '' })),
        catchError(e => of({ items: [] as MaintenanceRequest[], total: 0, error: e.message as string })))),
      takeUntilDestroyed()
    ).subscribe(r => {
      this.result.set({ items: r.items, total: r.total });
      this.error.set(r.error);
      this.loading.set(false);
    });
  }
}
