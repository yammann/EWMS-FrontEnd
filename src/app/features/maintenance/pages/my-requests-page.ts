import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MyMaintenanceRequest } from '../data-access/maintenance.models';
import { StatusChip } from '../components/maintenance-ui';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';

/**
 * «أجهزتي في الصيانة» (ViewMyMaintenanceRequests): طلبات الصيانة التي أنا عميلها — للمتابعة فقط.
 * إشعار تغيّر الحالة يفتح الصفحة على الطلب (?request=ID) ويُبرزه.
 */
@Component({
  selector: 'app-my-maintenance-requests', standalone: true, imports: [PageHeader, EmptyState, Alert, UtcPipe, DatePipe, StatusChip, Pager],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/maintenance.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="الصيانة" heading="أجهزتي في الصيانة" subtitle="أجهزتك التي سُلّمت لقسم الصيانة وحالتها — يصلك إشعار عند كل تغيير">
  <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" />

      <section class="panel">
        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length) { <div class="empty-state"><h3>لا توجد أجهزة لك في الصيانة</h3><p>عند تسليم جهاز لقسم الصيانة باسمك يظهر هنا.</p></div> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>رقم الطلب</th><th>الجهاز</th><th>الرقم التسلسلي</th><th>العطل</th><th>الحالة</th><th>الفني</th><th>تاريخ الاستلام</th><th>التسليم</th></tr></thead>
            <tbody>
              @for (r of pager.items(); track r.id) {
                <tr [class.highlight]="r.id === highlight()">
                  <td><span class="mono">{{ r.number }}</span></td>
                  <td><span class="cell-strong">{{ r.deviceName || r.deviceTypeName }}</span><small>{{ r.deviceTypeName }} · {{ r.deviceCompanyName }}{{ r.model ? ' · ' + r.model : '' }}</small></td>
                  <td><span class="mono">{{ r.serialNumber }}</span></td>
                  <td>{{ r.damageTypeName }}</td>
                  <td><app-status-chip [name]="r.statusName" [color]="r.statusColor" /></td>
                  <td>{{ r.technicianName }}</td>
                  <td class="nowrap">{{ r.createdAt | utc | date:'yyyy/MM/dd' }}</td>
                  <td class="nowrap">{{ r.deliveredAt ? (r.deliveredAt | utc | date:'yyyy/MM/dd') : '—' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
      </section>
    </div>`,
  styles: [`tr.highlight td { background: var(--brand-50); }`]
})
export class MaintenanceMyRequestsPage {
  pager = new Pagination(() => this.items());
  private service = inject(MaintenanceService);
  items = signal<MyMaintenanceRequest[]>([]);
  loading = signal(false);
  error = signal('');
  highlight = signal(0);

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => this.highlight.set(Number(p.get('request')) || 0));
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MyMaintenanceRequest') { this.highlight.set(n.relatedEntityId ?? 0); this.load(); }
    });
    this.load();
  }

  load() {
    trackRequest(this.service.myRequests(), this.loading, this.error, list => { this.items.set(list); });
  }
}
