import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaintenanceService } from '@core/services/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import {
  MaintenanceActivity, MaintenanceRequest, MaintenanceStatus, finalStageConfirm, formatHours, isFinalStage, stageLabel, utcDate
} from '@core/models/maintenance.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { CopyText } from '@shared/ui/secret-text';
import { AssignDialog, StatusChip } from './maintenance-ui';
import { RequestFormDialog, RequestLookups } from './request-form-dialog';
import { DeviceRepairHistory } from './device-repair-history';
import { TransferPanel } from './transfer-panel';
import { LinkedTasks } from '@features/task-board';
import { RequestPartsPanel } from './request-parts-panel';

const ACTIVITY_ICON: Record<number, string> = { 1: '＋', 2: '⇄', 3: '👤', 4: '✎', 5: '⇢', 6: '✕', 7: '⚙', 8: '↩' };

/**
 * صفحة طلب الصيانة: بيانات العميل والجهاز والعطل، تغيير الحالة بنقرة، نقل الطلب لفني آخر،
 * طباعة إيصال الاستلام وورقة التسليم، وسجل كل ما جرى على الطلب.
 */
@Component({
  selector: 'app-maintenance-request-details', standalone: true,
  imports: [DatePipe, RouterLink, StatusChip, CopyText, AssignDialog, RequestFormDialog, DeviceRepairHistory, TransferPanel, RequestPartsPanel, LinkedTasks],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">الصيانة · طلب صيانة</span>
          <h1 class="title">@if (request(); as r) { <span class="mono">{{ r.number }}</span> <app-status-chip [name]="r.statusName" [color]="r.statusColor" /> } @else { {{ loading() ? 'جارٍ التحميل…' : 'طلب الصيانة' }} }</h1>
          @if (request(); as r) { <p class="muted">{{ r.deviceTypeName }} {{ r.deviceCompanyName }}{{ r.model ? ' ' + r.model : '' }} — {{ r.clientName }}</p> }
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" type="button" (click)="goBack()">→ رجوع</button>
          @if (request(); as r) {
            <a class="btn btn-ghost" [routerLink]="['/maintenance/print', r.id, 'receipt']">🖨 إيصال الاستلام</a>
            <a class="btn btn-ghost" [routerLink]="['/maintenance/print', r.id, 'delivery']">🖨 ورقة التسليم</a>
            @if (canEdit()) { <button class="btn" type="button" (click)="openEdit()">تعديل</button> }
          }
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (request(); as r) {
        @if (r.isClosed) {
          <p class="alert notice closed-note" role="status">🔒 الطلب مُغلق ({{ stageLabel(r.statusStage) }}) — لا تعديل ولا تغيير حالة ولا نقل. إن عاد الجهاز يُسجَّل له طلب جديد.</p>
        }
        <app-transfer-panel [request]="r" (changed)="load(false)" />

        @if (canChangeStatus() && statuses().length) {
          <section class="panel">
            <div class="panel-heading"><div><h2>حالة الطلب</h2><p>انقر على الحالة الجديدة لتحديث الطلب — يُسجَّل التغيير ويصل إشعار للمعنيين. الحالات المعلَّمة بـ🔒 نهائية وتُقفل الطلب بعد التأكيد.</p></div></div>
            <div class="status-pick" role="radiogroup" aria-label="حالة الطلب">
              @for (s of statuses(); track s.id) {
                <button type="button" role="radio" [attr.aria-checked]="s.id === r.maintenanceRequestStatusId" [class.on]="s.id === r.maintenanceRequestStatusId"
                        [style.--c]="s.color" [disabled]="busy()" [title]="stageLabel(s.stage)" (click)="setStatus(s)"><i aria-hidden="true"></i>{{ s.name }}@if (isFinal(s.stage)) { <span aria-label="نهائية"> 🔒</span> }</button>
              }
            </div>
          </section>
        }

        <section class="panel">
          <div class="panel-heading"><div><h2>العميل والجهاز</h2></div></div>
          <dl class="facts">
            <div><dt>اسم العميل</dt><dd>{{ r.clientName }}</dd></div>
            <div><dt>الهاتف</dt><dd>@if (r.clientPhone) { <app-copy-text [value]="r.clientPhone" label="رقم الهاتف" /> } @else { — }</dd></div>
            <div><dt>تاريخ الاستلام</dt><dd>{{ utc(r.createdAt) | date:'yyyy/MM/dd — HH:mm' }}</dd></div>
            <div><dt>نوع الجهاز</dt><dd>{{ r.deviceTypeName }}</dd></div>
            <div><dt>الشركة المصنّعة</dt><dd>{{ r.deviceCompanyName }}</dd></div>
            <div><dt>الموديل</dt><dd>{{ r.model || '—' }}</dd></div>
            <div><dt>الرقم التسلسلي</dt><dd>@if (r.serialNumber) { <app-copy-text [value]="r.serialNumber" label="الرقم التسلسلي" /> } @else { — }</dd></div>
            <div><dt>الملحقات المستلمة</dt><dd>{{ r.accessories || '—' }}</dd></div>
          </dl>
        </section>

        @if (r.deviceMaintenanceId) {
          <section class="panel">
            <div class="panel-heading"><div><h2>سجل إصلاحات الجهاز</h2><p>طلبات الصيانة الأخرى للجهاز <span class="mono">{{ r.serialNumber }}</span>، الأحدث أولاً</p></div></div>
            <app-device-repair-history [deviceId]="r.deviceMaintenanceId" [excludeRequestId]="r.id" [limit]="10" />
          </section>
        }

        <section class="panel">
          <div class="panel-heading">
            <div><h2>الصيانة</h2></div>
            @if (canAssign()) { <button class="btn btn-ghost btn-sm" type="button" (click)="assignOpen.set(true)">تغيير الفني المسؤول</button> }
          </div>
          <dl class="facts">
            <div><dt>الفني المسؤول</dt><dd>{{ r.technicianName }}</dd></div>
            <div><dt>القسم</dt><dd>{{ r.departmentName || '—' }}</dd></div>
            <div><dt>نوع العطل</dt><dd>{{ r.damageTypeName }}</dd></div>
            <div><dt>المرحلة</dt><dd>{{ stageLabel(r.statusStage) }}</dd></div>
            <div><dt>بدء العمل <small class="hint">(تلقائي)</small></dt><dd>{{ r.startedAt ? (r.startedAt | date:'yyyy/MM/dd — HH:mm') : '—' }}</dd></div>
            <div><dt>الإنجاز <small class="hint">(تلقائي)</small></dt><dd>{{ r.completedAt ? (r.completedAt | date:'yyyy/MM/dd — HH:mm') : '—' }}</dd></div>
            <div><dt>مدة الإصلاح</dt><dd>{{ duration() }}</dd></div>
            <div class="wide"><dt>وصف العطل والملاحظات</dt><dd>{{ r.description || '—' }}</dd></div>
          </dl>
        </section>

        <app-request-parts-panel [request]="r" (changed)="load(false)" />

        <app-linked-tasks entityType="MaintenanceRequest" [entityId]="r.id" />

        <section class="panel">
          <div class="panel-heading"><div><h2>سجل الطلب</h2><p>كل ما جرى على الطلب، الأحدث أولاً</p></div></div>
          @if (!activities().length) { <p class="empty-state">لا يوجد سجل لهذا الطلب</p> }
          @else {
            <ol class="timeline">
              @for (a of activities(); track a.id) {
                <li class="t-{{ a.type }}">
                  <span class="dot" aria-hidden="true">{{ icon(a) }}</span>
                  <div><p><strong>{{ a.userName }}</strong> {{ a.text }}</p><time>{{ utc(a.createdAt) | date:'yyyy/MM/dd — HH:mm' }}</time></div>
                </li>
              }
            </ol>
          }
        </section>

        @if (canDelete()) {
          <section class="panel danger-zone">
            <div><h2>حذف الطلب</h2><p>يُحذف الطلب وسجله نهائياً ولا يمكن التراجع.</p></div>
            <button class="btn btn-danger" type="button" (click)="askDelete(r)" [disabled]="busy()">حذف الطلب</button>
          </section>
        }
      } @else if (loading()) { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }
    </div>

    @if (editOpen() && lookups(); as l) {
      <app-request-form-dialog [request]="request()" [lookups]="l" (saved)="saved($event)" (closed)="editOpen.set(false)" />
    }
    @if (assignOpen() && request(); as r) {
      <app-assign-dialog [subject]="r.number + ' — ' + r.clientName" [currentUserId]="r.userId" [departmentId]="r.departmentId"
                         [busy]="busy()" (assign)="assign($event)" (closed)="assignOpen.set(false)" />
    }`,
  styles: [`
    .title { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .title .mono { font-size: inherit; }
    .closed-note { margin: 0; }
    a.btn { text-decoration: none; }

    .status-pick { display: flex; flex-wrap: wrap; gap: 10px; }
    .status-pick button { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 16px; border-radius: var(--radius-full);
      background: var(--fill); color: var(--ink-700); font-weight: 700; border: 2px solid transparent; }
    .status-pick button:hover:not(:disabled) { background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: none; transform: none; }
    .status-pick button.on { background: color-mix(in srgb, var(--c) 16%, transparent); border-color: var(--c); color: var(--ink-900); }
    .status-pick i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }

    .timeline { list-style: none; margin: 0; padding: 0; display: grid; }
    .timeline li { position: relative; display: grid; grid-template-columns: 32px 1fr; gap: 12px; padding-bottom: 18px; }
    .timeline li:not(:last-child)::before { content: ''; position: absolute; inset-inline-start: 15px; top: 32px; bottom: 0; width: 2px; background: var(--border); }
    .timeline li:last-child { padding-bottom: 0; }
    .dot { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--fill); color: var(--ink-600); font-size: 14px; }
    .t-1 .dot { background: var(--brand-100); color: var(--brand-700); }
    .t-2 .dot { background: var(--info-100); color: var(--info-700); }
    .t-3 .dot { background: var(--warning-100); color: var(--warning-700); }
    .timeline p { margin: 4px 0 2px; font-size: 14px; color: var(--ink-700); }
    .timeline time { font-size: 12px; color: var(--ink-400); font-variant-numeric: tabular-nums; }

    .danger-zone { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .danger-zone h2 { font-size: 16px; margin: 0 0 4px; }
    .danger-zone p { margin: 0; font-size: 13px; color: var(--ink-500); }
  `]
})
export class MaintenanceRequestDetailsPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private location = inject(Location);

  utc = utcDate;
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

  goBack() {
    // العودة لنفس عرض القائمة (جدول/لوحة) إن جاء منها، وإلا لصفحة الطلبات
    if (history.length > 1) this.location.back(); else this.router.navigate(['/maintenance/requests']);
  }

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
