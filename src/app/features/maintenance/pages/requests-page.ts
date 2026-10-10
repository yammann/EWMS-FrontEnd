import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Observable, Subject, catchError, forkJoin, of, switchMap, tap, timer } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceCount, MaintenanceRequest, MaintenanceRequestFilter, MaintenanceStatus, TechnicianOption, finalStageConfirm, isFinalStage } from '../data-access/maintenance.models';
import { formatPhone } from '@core/utils/phone';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { StatusChip } from '../components/maintenance-ui';
import { Pager } from '@shared/ui/pager';
import { RequestFormDialog, RequestLookups } from '../components/request-form-dialog';
import { PendingTransfersButton } from '../components/transfer-panel';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { SelectValue } from '@shared/ui/select-value';

type View = 'table' | 'board';
type SearchField = 'clientName' | 'serialNumber' | 'model';

interface BoardColumn { status: MaintenanceStatus; items: MaintenanceRequest[]; total: number; page: number; }

const PAGE_SIZE = 20;
/** أقصى عدد بطاقات في عمود اللوحة (الأحدث أولاً) — الباقي يُعرض من الجدول */
/** بطاقات كل عمود في الصفحة الواحدة (لكل عمود تقسيم صفحاته) */
const BOARD_LIMIT = 5;

/**
 * طلبات الصيانة: جدول مع بحث وفلاتر وترقيم (من الخادم)، أو لوحة أعمدة بحسب الحالة
 * يتغيّر فيها حال الطلب بالسحب والإفلات (لمن يملك تعديل الطلب).
 */
@Component({
  selector: 'app-maintenance-requests-page', standalone: true,
  imports: [SelectValue, PageHeader, EmptyState, Alert, UtcPipe, DatePipe, RouterLink, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, StatusChip, Pager, RequestFormDialog, PendingTransfersButton],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss', './requests-page.scss'],
  templateUrl: './requests-page.html'
})
export class MaintenanceRequestsPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  can = this.service.can;
  phone = formatPhone;
  pageSize = PAGE_SIZE;
  boardLimit = BOARD_LIMIT;

  lookups = signal<RequestLookups | null>(null);
  technicians = signal<TechnicianOption[]>([]);
  statusCounts = signal<MaintenanceCount[]>([]);

  view = signal<View>('table');
  searchField = signal<SearchField>('clientName');
  setSearchField(value: string) { this.searchField.set(value as SearchField); }
  searchText = signal('');
  statusId = signal(0);
  technicianId = signal(0);
  deviceTypeId = signal(0);
  damageTypeId = signal(0);
  companyId = signal(0);
  page = signal(1);

  rows = signal<MaintenanceRequest[]>([]);
  total = signal(0);
  columns = signal<BoardColumn[]>([]);
  loading = signal(false);
  error = signal('');
  formOpen = signal(false);

  hasFilter = computed(() => !!(this.searchText().trim() || this.technicianId() || this.deviceTypeId() || this.damageTypeId() || this.companyId()));
  totalAll = computed(() => this.statusCounts().reduce((sum, s) => sum + s.count, 0));
  canDrag = computed(() => this.can().changeStatus);

  /** كل طلب تحميل يمر من هنا: تأخير قصير أثناء الكتابة، وإلغاء الطلب السابق إن لم يكتمل */
  private reload$ = new Subject<number>();

  constructor() {
    this.reload$.pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(delay => timer(delay).pipe(switchMap(() => this.fetch()))),
      takeUntilDestroyed()
    ).subscribe(() => this.loading.set(false));

    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const view: View = p.get('view') === 'board' ? 'board' : 'table';
      if (view !== this.view() || !this.lookups()) { this.view.set(view); if (this.lookups()) this.reload$.next(0); }
    });

    // تحديث تلقائي عند وصول إشعار صيانة (طلب جديد / تغيّر حالة / نقل)
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MaintenanceRequest') this.refresh();
    });

    this.loadLookups();
  }

  private loadLookups() {
    this.loading.set(true);
    forkJoin({
      deviceTypes: this.service.lookup('deviceTypes'), companies: this.service.lookup('companies'),
      damageTypes: this.service.lookup('damageTypes'), statuses: this.service.lookup<MaintenanceStatus>('statuses'),
      technicians: this.service.technicians()
    }).subscribe({
      next: ({ technicians, ...lookups }) => { this.lookups.set(lookups); this.technicians.set(technicians); this.reload$.next(0); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  private filter(): MaintenanceRequestFilter {
    const text = this.searchText().trim();
    return {
      [this.searchField()]: text || undefined,
      technicianId: this.technicianId(), deviceTypeId: this.deviceTypeId(),
      damageTypeId: this.damageTypeId(), deviceCompanyId: this.companyId()
    };
  }

  private fetch(): Observable<unknown> {
    const fail = (e: { message: string }) => { this.error.set(e.message); return of(null); };

    // أعداد الحالات (ضمن نطاقي) لشارات التصفية
    const counts$ = this.service.stats().pipe(tap(s => this.statusCounts.set(s.byStatus)), catchError(() => of(null)));

    if (this.view() === 'board') {
      const statuses = this.lookups()?.statuses ?? [];
      if (!statuses.length) { this.columns.set([]); return of(null); }
      // كل عمود يعرض صفحته الحالية (تبقى عند التحديث)
      return forkJoin(statuses.map(status => this.loadColumn(status, this.columns().find(c => c.status.id === status.id)?.page ?? 1)))
        .pipe(tap(columns => this.columns.set(columns)), catchError(fail));
    }

    return forkJoin([
      this.service.requests({ ...this.filter(), statusId: this.statusId(), page: this.page(), pageSize: PAGE_SIZE }).pipe(
        tap(r => { this.rows.set(r.items); this.total.set(r.totalCount); }), catchError(fail)),
      counts$
    ]);
  }

  /** صفحة واحدة من عمود؛ إن تجاوزت الأخيرة (بعد نقل بطاقات) تُجلب آخر صفحة موجودة */
  private loadColumn(status: MaintenanceStatus, page: number): Observable<BoardColumn> {
    return this.service.requests({ ...this.filter(), statusId: status.id, page, pageSize: BOARD_LIMIT }).pipe(
      switchMap(r => !r.items.length && r.totalCount > 0 && page > 1
        ? this.loadColumn(status, Math.ceil(r.totalCount / BOARD_LIMIT))
        : of({ status, items: r.items, total: r.totalCount, page })));
  }

  columnPages(col: BoardColumn) { return Math.max(1, Math.ceil(col.total / BOARD_LIMIT)); }

  /** ينتقل عمود واحد إلى صفحة أخرى دون المساس ببقية الأعمدة */
  columnTo(col: BoardColumn, page: number) {
    this.loading.set(true);
    this.loadColumn(col.status, page).subscribe({
      next: fresh => { this.columns.update(list => list.map(c => c.status.id === fresh.status.id ? fresh : c)); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  /** تغيّر فلتر: العودة لأول صفحة ثم التحميل بعد توقف الكتابة */
  changed() { this.page.set(1); this.columns.update(list => list.map(c => ({ ...c, page: 1 }))); this.reload$.next(300); }
  refresh() { this.reload$.next(0); }
  goTo(page: number) { this.page.set(page); this.reload$.next(0); }
  setStatus(id: number) { this.statusId.set(id); this.page.set(1); this.reload$.next(0); }

  setView(view: View) {
    this.router.navigate([], { queryParams: { view: view === 'board' ? 'board' : null }, queryParamsHandling: 'merge' });
  }

  clearFilters() {
    this.searchText.set(''); this.technicianId.set(0); this.deviceTypeId.set(0); this.damageTypeId.set(0); this.companyId.set(0);
    this.changed();
  }

  countOf(statusId: number) { return this.statusCounts().find(s => s.id === statusId)?.count ?? 0; }

  open(r: MaintenanceRequest) { this.router.navigate(['/maintenance/requests', r.id]); }

  created(r: MaintenanceRequest) {
    this.formOpen.set(false);
    this.toast.success(`تم تسجيل الطلب ${r.number}`);
    this.router.navigate(['/maintenance/requests', r.id]);
  }

  // ─────────── السحب والإفلات (لوحة الحالات) ───────────
  draggable(r: MaintenanceRequest) { return this.canDrag() && r.canChangeStatus; }
  canDrop = (drag: CdkDrag<MaintenanceRequest>) => this.draggable(drag.data);

  async drop(event: CdkDragDrop<number>) {
    if (event.previousContainer === event.container) return;
    const request = event.item.data as MaintenanceRequest;
    const from = request.maintenanceRequestStatusId;
    const to = event.container.data;
    const target = this.columns().find(c => c.status.id === to)?.status;
    if (!target) return;

    // الحالة النهائية تُقفل الطلب — لا تكفي سحبة: تأكيد صريح، وعند الإلغاء تبقى البطاقة مكانها
    const final = isFinalStage(target.stage);
    if (final && !await this.confirm.ask(finalStageConfirm(request.number, target.name), 'نعم، أقفل الطلب', 'حالة نهائية')) return;

    // تحديث متفائل ثم التراجع إن رفض الخادم
    this.move(request, from, to, {
      maintenanceRequestStatusId: to, statusName: target.name, statusColor: target.color, statusStage: target.stage,
      ...(final ? { isClosed: true, canChangeStatus: false, canEdit: false, canAssign: false, canRequestTransfer: false } : {})
    });
    this.service.changeStatus(request.id, to).subscribe({
      next: () => {
        this.toast.success(`${request.number} ← ${target.name}`);
        for (const id of [from, to]) { const col = this.columns().find(c => c.status.id === id); if (col) this.columnTo(col, id === to ? 1 : col.page); }
      },
      error: e => { this.move({ ...request, maintenanceRequestStatusId: to }, to, from, request); this.toast.error(e.message); }
    });
  }

  private move(request: MaintenanceRequest, from: number, to: number, changes: Partial<MaintenanceRequest>) {
    const moved = { ...request, ...changes };
    this.columns.update(columns => columns.map(c =>
      c.status.id === from ? { ...c, items: c.items.filter(r => r.id !== request.id), total: c.total - 1 }
        : c.status.id === to ? { ...c, items: [moved, ...c.items].slice(0, BOARD_LIMIT), total: c.total + 1 }
          : c));
  }
}
