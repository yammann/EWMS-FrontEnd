import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Observable, Subject, catchError, forkJoin, of, switchMap, tap, timer } from 'rxjs';
import { MaintenanceService } from '@core/services/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceCount, MaintenanceRequest, MaintenanceRequestFilter, MaintenanceStatus, TechnicianOption, finalStageConfirm, isFinalStage } from '@core/models/maintenance.models';
import { formatPhone } from '@core/utils/phone';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { StatusChip } from './maintenance-ui';
import { Pager } from '@shared/ui/pager';
import { RequestFormDialog, RequestLookups } from './request-form-dialog';
import { PendingTransfersButton } from './transfer-panel';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';

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
  imports: [EmptyState, Alert, UtcPipe, DatePipe, RouterLink, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, StatusChip, Pager, RequestFormDialog, PendingTransfersButton],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss', './requests-page.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الصيانة</span><h1>طلبات الصيانة</h1><p class="muted">الأجهزة المستلمة للإصلاح ومتابعة حالتها حتى التسليم</p></div>
        <div class="header-actions">
          @if (can().assignRequest) { <app-pending-transfers-button /> }
          @if (can().createRequest) { <button class="btn" type="button" (click)="formOpen.set(true)" [disabled]="!lookups()">+ طلب جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="refresh()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <app-alert [message]="error()" />

      <div class="filters">
        <div class="filters-row">
          <div class="search-group">
            <select [value]="searchField()" (change)="searchField.set($any($event.target).value); searchText() && changed()" aria-label="البحث في">
              <option value="clientName">اسم العميل</option>
              <option value="serialNumber">الرقم التسلسلي</option>
              <option value="model">الموديل</option>
            </select>
            <input class="search" type="search" [placeholder]="searchField() === 'clientName' ? 'بحث باسم العميل…' : 'يبدأ بـ…'"
                   [value]="searchText()" (input)="searchText.set($any($event.target).value); changed()" aria-label="بحث">
          </div>
          <div class="segmented" role="tablist" aria-label="طريقة العرض">
            <button type="button" role="tab" [class.on]="view() === 'table'" [attr.aria-selected]="view() === 'table'" (click)="setView('table')">جدول</button>
            <button type="button" role="tab" [class.on]="view() === 'board'" [attr.aria-selected]="view() === 'board'" (click)="setView('board')">لوحة الحالات</button>
          </div>
        </div>
        <div class="filters-row">
          @if (technicians().length > 1) {
            <select (change)="technicianId.set(+$any($event.target).value); changed()" aria-label="الفني">
              <option [value]="0" [selected]="!technicianId()">كل الفنيين</option>
              @for (t of technicians(); track t.id) { <option [value]="t.id" [selected]="t.id === technicianId()">{{ t.fullName }}</option> }
            </select>
          }
          <select (change)="deviceTypeId.set(+$any($event.target).value); changed()" aria-label="نوع الجهاز">
            <option [value]="0" [selected]="!deviceTypeId()">كل أنواع الأجهزة</option>
            @for (x of lookups()?.deviceTypes; track x.id) { <option [value]="x.id" [selected]="x.id === deviceTypeId()">{{ x.name }}</option> }
          </select>
          <select (change)="companyId.set(+$any($event.target).value); changed()" aria-label="الشركة">
            <option [value]="0" [selected]="!companyId()">كل الشركات</option>
            @for (x of lookups()?.companies; track x.id) { <option [value]="x.id" [selected]="x.id === companyId()">{{ x.name }}</option> }
          </select>
          <select (change)="damageTypeId.set(+$any($event.target).value); changed()" aria-label="نوع العطل">
            <option [value]="0" [selected]="!damageTypeId()">كل الأعطال</option>
            @for (x of lookups()?.damageTypes; track x.id) { <option [value]="x.id" [selected]="x.id === damageTypeId()">{{ x.name }}</option> }
          </select>
          @if (hasFilter()) { <button type="button" class="btn btn-ghost btn-sm" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>
      </div>

      @if (view() === 'table') {
        <!-- شارات الحالات: العدد ضمن نطاقي، والنقر يفلتر -->
        <div class="status-tabs" role="tablist" aria-label="تصفية حسب الحالة">
          <button type="button" role="tab" [class.on]="!statusId()" [attr.aria-selected]="!statusId()" (click)="setStatus(0)">الكل <b>{{ totalAll() }}</b></button>
          @for (s of lookups()?.statuses; track s.id) {
            <button type="button" role="tab" [class.on]="statusId() === s.id" [attr.aria-selected]="statusId() === s.id" [style.--c]="s.color" (click)="setStatus(s.id)">
              <i aria-hidden="true"></i>{{ s.name }} <b>{{ countOf(s.id) }}</b>
            </button>
          }
        </div>

        <section class="panel">
          @if (loading() && !rows().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
          @else if (!rows().length) {
            <div class="empty-state"><h3>{{ hasFilter() || statusId() ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات صيانة بعد' }}</h3>
              <p>{{ hasFilter() || statusId() ? 'جرّب تعديل البحث أو الفلاتر.' : 'سجّل أول طلب عند استلام جهاز من عميل.' }}</p></div>
          } @else {
            <div class="table-wrap" [class.dim]="loading()"><table>
              <thead><tr><th>رقم الطلب</th><th>العميل</th><th>الجهاز</th><th>الرقم التسلسلي</th><th>العطل</th><th>الحالة</th><th>الفني</th><th>تاريخ الاستلام</th></tr></thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr class="clickable" (click)="open(r)">
                    <td><a class="number mono" [routerLink]="['/maintenance/requests', r.id]" (click)="$event.stopPropagation()">{{ r.number }}</a></td>
                    <td><span class="cell-strong">{{ r.clientName }}</span>@if (r.clientPhone) { <small class="mono">{{ phone(r.clientPhone) }}</small> }</td>
                    <td><span class="cell-strong">{{ r.deviceTypeName }}</span><small>{{ r.deviceCompanyName }}{{ r.model ? ' · ' + r.model : '' }}</small></td>
                    <td>@if (r.serialNumber) { <span class="mono">{{ r.serialNumber }}</span> } @else { <span class="muted-cell">—</span> }</td>
                    <td>{{ r.damageTypeName }}</td>
                    <td><app-status-chip [name]="r.statusName" [color]="r.statusColor" /></td>
                    <td>{{ r.technicianName }}</td>
                    <td class="nowrap">{{ r.createdAt | utc | date:'yyyy/MM/dd' }}<small>{{ r.createdAt | utc | date:'HH:mm' }}</small></td>
                  </tr>
                }
              </tbody>
            </table></div>
            <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
          }
        </section>
      } @else {
        @if (!canDrag()) { <p class="readonly-note">وضع المشاهدة — تغيير الحالة لمن يملك صلاحية تغيير حالة الطلب</p> }
        @if (loading() && !columns().length) { <app-empty-state panel>جارٍ تحميل اللوحة…</app-empty-state> }
        @else if (!columns().length) { <div class="panel empty-state"><h3>لا توجد حالات معرّفة</h3><p>أضف حالات الطلب من «إعدادات الصيانة».</p></div> }
        @else {
          <div class="board" cdkDropListGroup [style.--cols]="columns().length">
            @for (col of columns(); track col.status.id) {
              <section class="column" [style.--c]="col.status.color" [attr.aria-label]="col.status.name">
                <header class="col-head">
                  <span class="col-dot" aria-hidden="true"></span>
                  <h2>{{ col.status.name }}</h2>
                  <span class="col-count">{{ col.total }}</span>
                </header>
                <div class="col-body" cdkDropList [id]="'st-' + col.status.id" [cdkDropListData]="col.status.id"
                     [cdkDropListEnterPredicate]="canDrop" (cdkDropListDropped)="drop($event)">
                  @for (r of col.items; track r.id) {
                    <article class="card" cdkDrag [cdkDragData]="r" [cdkDragDisabled]="!draggable(r)" [class.draggable]="draggable(r)"
                             tabindex="0" role="button" (click)="open(r)" (keydown.enter)="open(r)" [attr.aria-label]="r.number + ' — ' + r.clientName">
                      <div class="card-top"><span class="mono number">{{ r.number }}</span><small>{{ r.createdAt | utc | date:'MM/dd' }}</small></div>
                      <h3>{{ r.deviceTypeName }} <span>{{ r.deviceCompanyName }}{{ r.model ? ' ' + r.model : '' }}</span></h3>
                      <p class="damage">{{ r.damageTypeName }}</p>
                      <footer class="card-foot"><small>{{ r.clientName }}</small><small class="tech">{{ r.technicianName }}</small></footer>
                      <div class="drop-ghost" *cdkDragPlaceholder></div>
                    </article>
                  } @empty { <p class="col-empty">لا توجد طلبات</p> }
                </div>
                @if (col.total > boardLimit) {
                  <nav class="col-pager" [attr.aria-label]="'صفحات ' + col.status.name">
                    <button type="button" (click)="columnTo(col, col.page - 1)" [disabled]="col.page <= 1 || loading()" aria-label="الصفحة السابقة">‹</button>
                    <span>{{ col.page }} / {{ columnPages(col) }} <small>({{ col.total }})</small></span>
                    <button type="button" (click)="columnTo(col, col.page + 1)" [disabled]="col.page >= columnPages(col) || loading()" aria-label="الصفحة التالية">›</button>
                  </nav>
                }
              </section>
            }
          </div>
        }
      }
    </div>

    @if (formOpen() && lookups(); as l) {
      <app-request-form-dialog [lookups]="l" (saved)="created($event)" (closed)="formOpen.set(false)" />
    }`
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
