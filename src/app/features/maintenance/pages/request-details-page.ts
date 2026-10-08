import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceActivity, MaintenanceRequest, MaintenanceStatus, finalStageConfirm, formatHours, isFinalStage, stageLabel } from '../data-access/maintenance.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { CopyText } from '@shared/ui/secret-text';
import { AssignDialog, StatusChip } from '../components/maintenance-ui';
import { RequestFormDialog, RequestLookups } from '../components/request-form-dialog';
import { DeviceRepairHistory } from '../components/device-repair-history';
import { TransferPanel } from '../components/transfer-panel';
import { LinkedTasks } from '@features/task-board';
import { RequestPartsPanel } from '../components/request-parts-panel';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';

const ACTIVITY_ICON: Record<number, string> = { 1: '＋', 2: '⇄', 3: '👤', 4: '✎', 5: '⇢', 6: '✕', 7: '⚙', 8: '↩' };

/**
 * صفحة طلب الصيانة: بيانات العميل والجهاز والعطل، تغيير الحالة بنقرة، نقل الطلب لفني آخر،
 * طباعة إيصال الاستلام وورقة التسليم، وسجل كل ما جرى على الطلب.
 */
@Component({
  selector: 'app-maintenance-request-details', standalone: true,
  imports: [EmptyState, Alert, UtcPipe, DatePipe, RouterLink, StatusChip, CopyText, AssignDialog, RequestFormDialog, DeviceRepairHistory, TransferPanel, RequestPartsPanel, LinkedTasks],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss', './request-details-page.scss'],
  templateUrl: './request-details-page.html',
  
})
export class MaintenanceRequestDetailsPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  stageLabel = stageLabel;
  isFinal = isFinalStage;
  private can = this.service.can;
  private id = 0;

  request = signal<MaintenanceRequest | null>(null);
  activities = signal<MaintenanceActivity[]>([]);
  statuses = signal<MaintenanceStatus[]>([]);
  lookups = signal<RequestLookups | null>(null);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  editOpen = signal(false);
  assignOpen = signal(false);

  canEdit = computed(() => this.can().editRequest && !!this.request()?.canEdit);
  canChangeStatus = computed(() => this.can().changeStatus && !!this.request()?.canChangeStatus);
  canAssign = computed(() => this.can().assignRequest && !!this.request()?.canAssign);
  canDelete = computed(() => this.can().deleteRequest && !!this.request()?.canDelete);

  duration = computed(() => {
    const r = this.request();
    if (!r?.startedAt || !r.completedAt) return '—';
    return formatHours((Date.parse(r.completedAt) - Date.parse(r.startedAt)) / 3_600_000);
  });

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id = Number(p.get('id'));
      this.request.set(null); this.activities.set([]);
      this.load();
    });

    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MaintenanceRequest' && n.relatedEntityId === this.id) this.load(false);
    });

    this.service.lookup<MaintenanceStatus>('statuses').subscribe({ next: s => this.statuses.set(s), error: () => { } });
  }

  load(showSpinner = true) {
    if (showSpinner) this.loading.set(true);
    this.error.set('');
    forkJoin({ request: this.service.request(this.id), activities: this.service.activities(this.id) }).subscribe({
      next: r => { this.request.set(r.request); this.activities.set(r.activities); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  icon(a: MaintenanceActivity) { return ACTIVITY_ICON[a.type] ?? '•'; }


  async setStatus(status: MaintenanceStatus) {
    const r = this.request();
    if (!r || r.maintenanceRequestStatusId === status.id || this.busy()) return;
    // الحالة النهائية تُقفل الطلب — تأكيد صريح لا نقرة واحدة
    if (isFinalStage(status.stage) && !await this.confirm.ask(finalStageConfirm(r.number, status.name), 'نعم، أقفل الطلب', 'حالة نهائية')) return;
    this.busy.set(true);
    this.service.changeStatus(r.id, status.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success(`الحالة ← ${status.name}`); this.load(false); },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }

  openEdit() {
    if (this.lookups()) { this.editOpen.set(true); return; }
    forkJoin({
      deviceTypes: this.service.lookup('deviceTypes'), companies: this.service.lookup('companies'),
      damageTypes: this.service.lookup('damageTypes'), statuses: this.service.lookup<MaintenanceStatus>('statuses')
    }).subscribe({
      next: l => { this.lookups.set(l); this.editOpen.set(true); },
      error: e => this.toast.error(e.message)
    });
  }

  saved(r: MaintenanceRequest) {
    this.editOpen.set(false);
    this.toast.success('تم حفظ التعديلات');
    this.request.set(r);
    this.load(false);
  }

  assign(userId: number) {
    const r = this.request();
    if (!r) return;
    this.busy.set(true);
    this.service.assignRequest(r.id, userId).subscribe({
      next: updated => {
        this.busy.set(false); this.assignOpen.set(false);
        this.toast.success(`نُقل الطلب إلى ${updated.technicianName}`);
        this.load(false);
      },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }

  async askDelete(r: MaintenanceRequest) {
    if (!await this.confirm.ask(`حذف طلب الصيانة ${r.number} (${r.clientName}) نهائياً؟`, 'حذف')) return;
    this.busy.set(true);
    this.service.deleteRequest(r.id).subscribe({
      next: () => { this.toast.success('تم حذف الطلب'); this.router.navigate(['/maintenance/requests']); },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }
}
