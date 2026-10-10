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
import { trackRequest } from '@shared/ui/track-request';

/**
 * «أجهزتي في الصيانة» (ViewMyMaintenanceRequests): طلبات الصيانة التي أنا عميلها — للمتابعة فقط.
 * إشعار تغيّر الحالة يفتح الصفحة على الطلب (?request=ID) ويُبرزه.
 */
@Component({
  selector: 'app-my-maintenance-requests', standalone: true, imports: [PageHeader, EmptyState, Alert, UtcPipe, DatePipe, StatusChip, Pager],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './my-requests-page.html',
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
