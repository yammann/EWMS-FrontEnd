import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NamedRef, SparePartReport } from '../data-access/spare-part.models';
import { StatTile } from '@shared/ui/stat-tile';
import { MoneyPipe, QtyPipe } from '@shared/pipes/format.pipes';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

/**
 * تقارير قطع الغيار (قرار المستخدم 2026-10-05 — بلا نسب التكلفة للأقسام): قيمة المخزون، أكثر القطع صرفاً في الفترة،
 * وأعلى الأجهزة تكلفة على مدى عمرها مع تنبيه «إصلاحه أغلى من استبداله» حسب حد نوع الجهاز.
 */
@Component({
  selector: 'app-spare-parts-report-page', standalone: true, imports: [PageHeader, EmptyState, Alert, QtyPipe, MoneyPipe, RouterLink, StatTile],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/devices.scss', '../../../shared/styles/maintenance.scss', './requests-page.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="الصيانة · قطع الغيار" heading="تقارير قطع الغيار" subtitle="المخزون، أكثر القطع صرفاً، وتكلفة الأجهزة على مدى عمرها">
  
            @if (can().viewParts) { <a class="btn btn-ghost" routerLink="/maintenance/parts">قطع الغيار</a> }
            <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

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

      <app-alert [message]="error()" />

      @if (report(); as r) {
        <section class="stats-4" aria-label="ملخص">
          <app-stat-tile label="قيمة المخزون" [value]="(r.stockValue | money)" icon="📦" tone="green" [hint]="r.partsCount + ' قطعة'" />
          <app-stat-tile label="تحت الحد الأدنى" [value]="r.lowStockCount" icon="⚠" tone="orange" hint="قطع تحتاج إدخالاً" />
          <app-stat-tile label="المصروف في الفترة" [value]="(r.issuedCost | money)" icon="🧾" tone="blue" hint="قطع صُرفت على الطلبات" />
          <app-stat-tile label="أجهزة بقطع مصروفة" [value]="r.deviceCosts.length" icon="🖥" tone="purple" hint="من الأعلى تكلفة" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>أكثر القطع صرفاً</h2><p>من {{ r.from.slice(0, 10) }} إلى {{ r.to.slice(0, 10) }} — صافي بعد الإرجاع</p></div></div>
          @if (!r.mostUsed.length) { <app-empty-state>لم تُصرف قطع في هذه الفترة</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>القطعة</th><th>الكمية</th><th>التكلفة</th></tr></thead>
              <tbody>@for (u of r.mostUsed; track u.sparePartId) {
                <tr><td class="cell-strong">{{ u.name }}</td><td class="num">{{ u.quantity | qty }} {{ u.unit }}</td><td class="num">{{ u.cost | money }}</td></tr>
              }</tbody>
            </table></div>
          }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>تكلفة الأجهزة على مدى عمرها</h2><p>أعلى 20 جهازاً تكلفة في قطع الغيار</p></div></div>
          @if (!r.deviceCosts.length) { <app-empty-state>لا توجد قطع مصروفة على أجهزة بعد</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الجهاز</th><th>النوع</th><th>طلبات بقطع</th><th>التكلفة</th></tr></thead>
              <tbody>@for (d of r.deviceCosts; track d.deviceMaintenanceId) {
                <tr>
                  <td><span class="mono cell-strong">{{ d.serialNumber }}</span>@if (d.deviceName) { <small>{{ d.deviceName }}</small> }</td>
                  <td>{{ d.deviceTypeName }}</td>
                  <td class="num">{{ d.requestsCount }}</td>
                  <td class="num cell-strong">{{ d.cost | money }}</td>
                </tr>
              }</tbody>
            </table></div>
          }
        </section>
      } @else if (loading()) { <app-empty-state panel>جارٍ التحميل…</app-empty-state> }
    </div>`,
  styles: [`
    .period { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td small { display: block; color: var(--ink-500); }
    a.btn { text-decoration: none; }
  `]
})
export class MaintenanceSparePartsReportPage {
  private service = inject(MaintenanceService);
  can = this.service.can;

  today = localDateInput(new Date());
  from = signal(localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  to = signal(this.today);
  departmentId = signal(0);
  departments = signal<NamedRef[]>([]);

  report = signal<SparePartReport | null>(null);
  loading = signal(false);
  error = signal('');

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
