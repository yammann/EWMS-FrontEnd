import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { NamedRef, SparePartReport, money, qty } from '../../core/models/spare-part.models';
import { StatTile } from '../dashboard/dashboard-widgets';

function dateInput(d: Date): string {
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

/**
 * تقارير قطع الغيار (قرار المستخدم 2026-10-05 — بلا نسب التكلفة للأقسام): قيمة المخزون، أكثر القطع صرفاً في الفترة،
 * وأعلى الأجهزة تكلفة على مدى عمرها مع تنبيه «إصلاحه أغلى من استبداله» حسب حد نوع الجهاز.
 */
@Component({
  selector: 'app-spare-parts-report-page', standalone: true, imports: [RouterLink, StatTile],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss', './requests-page.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الصيانة · قطع الغيار</span><h1>تقارير قطع الغيار</h1><p class="muted">المخزون، أكثر القطع صرفاً، وتكلفة الأجهزة على مدى عمرها</p></div>
        <div class="header-actions">
          @if (can().viewParts) { <a class="btn btn-ghost" routerLink="/maintenance/parts">قطع الغيار</a> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <div class="filters">
        <div class="filters-row">
          <label class="period">من <input type="date" [value]="from()" [max]="to()" (change)="from.set($any($event.target).value); load()"></label>
          <label class="period">إلى <input type="date" [value]="to()" [min]="from()" [max]="today" (change)="to.set($any($event.target).value); load()"></label>
          @if (departments().length > 1) {
            <select (change)="departmentId.set(+$any($event.target).value); load()" aria-label="القسم">
              <option [value]="0">كل الأقسام</option>
              @for (d of departments(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }
            </select>
          }
        </div>
      </div>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (report(); as r) {
        <section class="stats-4" aria-label="ملخص">
          <app-stat-tile label="قيمة المخزون" [value]="money(r.stockValue)" icon="📦" tone="green" [hint]="r.partsCount + ' قطعة'" />
          <app-stat-tile label="تحت الحد الأدنى" [value]="r.lowStockCount" icon="⚠" tone="orange" hint="قطع تحتاج إدخالاً" />
          <app-stat-tile label="المصروف في الفترة" [value]="money(r.issuedCost)" icon="🧾" tone="blue" hint="قطع صُرفت على الطلبات" />
          <app-stat-tile label="أجهزة بلغت حد الاستبدال" [value]="overCount()" icon="♻" tone="purple" hint="من الأعلى تكلفة" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>أكثر القطع صرفاً</h2><p>من {{ r.from.slice(0, 10) }} إلى {{ r.to.slice(0, 10) }} — صافي بعد الإرجاع</p></div></div>
          @if (!r.mostUsed.length) { <p class="empty-state">لم تُصرف قطع في هذه الفترة</p> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>القطعة</th><th>الكمية</th><th>التكلفة</th></tr></thead>
              <tbody>@for (u of r.mostUsed; track u.sparePartId) {
                <tr><td class="cell-strong">{{ u.name }}</td><td class="num">{{ qty(u.quantity) }} {{ u.unit }}</td><td class="num">{{ money(u.cost) }}</td></tr>
              }</tbody>
            </table></div>
          }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>تكلفة الأجهزة على مدى عمرها</h2><p>أعلى 20 جهازاً تكلفة في قطع الغيار — والحد من «إعدادات الصيانة» لكل نوع جهاز</p></div></div>
          @if (!r.deviceCosts.length) { <p class="empty-state">لا توجد قطع مصروفة على أجهزة بعد</p> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الجهاز</th><th>النوع</th><th>طلبات بقطع</th><th>التكلفة</th><th>حد الاستبدال</th></tr></thead>
              <tbody>@for (d of r.deviceCosts; track d.deviceMaintenanceId) {
                <tr [class.over]="d.overThreshold">
                  <td><span class="mono cell-strong">{{ d.serialNumber }}</span>@if (d.deviceName) { <small>{{ d.deviceName }}</small> }</td>
                  <td>{{ d.deviceTypeName }}</td>
                  <td class="num">{{ d.requestsCount }}</td>
                  <td class="num cell-strong">{{ money(d.cost) }}</td>
                  <td>@if (d.threshold) { {{ money(d.threshold) }}@if (d.overThreshold) { <span class="over-badge">إصلاحه أغلى من استبداله</span> } } @else { <span class="muted-cell">—</span> }</td>
                </tr>
              }</tbody>
            </table></div>
          }
        </section>
      } @else if (loading()) { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }
    </div>`,
  styles: [`
    .period { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td small { display: block; color: var(--ink-500); }
    tr.over td:first-child { box-shadow: inset -3px 0 0 var(--danger-700); }
    .over-badge { display: inline-block; margin-inline-start: 6px; padding: 1px 8px; border-radius: var(--radius-full);
      background: var(--danger-100); color: var(--danger-700); font-size: 11px; font-weight: 700; }
    a.btn { text-decoration: none; }
  `]
})
export class MaintenanceSparePartsReportPage {
  private service = inject(MaintenanceService);
  can = this.service.can;
  money = money; qty = qty;

  today = dateInput(new Date());
  from = signal(dateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  to = signal(this.today);
  departmentId = signal(0);
  departments = signal<NamedRef[]>([]);

  report = signal<SparePartReport | null>(null);
  loading = signal(false);
  error = signal('');
  overCount = computed(() => this.report()?.deviceCosts.filter(d => d.overThreshold).length ?? 0);

  constructor() {
    if (this.can().viewParts) this.service.partDepartments().subscribe({ next: d => this.departments.set(d), error: () => { } });
    this.load();
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.partReport({ departmentId: this.departmentId() || null, from: this.from(), to: this.to() }).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
