import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceCount, MaintenanceStats, formatHours } from '../data-access/maintenance.models';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

/** أعمدة أفقية لعدد الطلبات — بلون الحالة إن وُجد، وإلا بلون الهوية */
@Component({
  selector: 'app-maint-bars', standalone: true,
  template: `
    @if (items().length) {
      <ul class="bars" role="list">
        @for (item of shown(); track item.id) {
          <li [attr.title]="item.name + ': ' + item.count">
            <span class="label">{{ item.name }}</span>
            <span class="track" aria-hidden="true"><span class="fill" [style.width.%]="100 * item.count / max()" [style.background]="item.color || null"></span></span>
            <span class="value">{{ item.count }}<small>{{ percent(item) }}%</small></span>
          </li>
        }
      </ul>
      @if (items().length > limit()) { <p class="more">و{{ items().length - limit() }} أخرى بأعداد أقل</p> }
    } @else { <p class="none">لا توجد بيانات</p> }`,
  styles: [`
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: minmax(110px, 200px) 1fr 84px; align-items: center; gap: 14px; padding: 5px 8px; border-radius: var(--radius-sm); }
    li:hover { background: var(--fill); }
    .label { font-size: 13px; font-weight: 700; color: var(--ink-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 10px; background: var(--fill); border-radius: 5px; overflow: hidden; }
    .fill { display: block; height: 100%; min-width: 4px; background: var(--brand-600); border-radius: 5px; }
    .value { font-size: 13px; font-weight: 700; color: var(--ink-900); text-align: left; font-variant-numeric: tabular-nums; }
    .value small { margin-inline-start: 6px; font-size: 11px; font-weight: 400; color: var(--ink-400); }
    .none, .more { margin: 0; text-align: center; color: var(--ink-400); font-size: 13px; }
    .none { padding: 18px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
    .more { padding-top: 10px; font-size: 12px; }
  `]
})
export class MaintBars {
  items = input.required<MaintenanceCount[]>();
  limit = input(8);
  shown = computed(() => this.items().slice(0, this.limit()));
  max = computed(() => Math.max(1, ...this.items().map(i => i.count)));
  private sum = computed(() => this.items().reduce((total, i) => total + i.count, 0) || 1);
  percent(item: MaintenanceCount) { return Math.round(100 * item.count / this.sum()); }
}

/**
 * إحصائيات الصيانة ضمن نطاق المستخدم (سجلاته / قسمه / فرعه / الكل):
 * الطلبات حسب الحالة والفني ونوع العطل والجهاز والشركة، حركة آخر 6 أشهر، ومهام الصيانة حسب الموظف.
 */
@Component({
  selector: 'app-maintenance-stats-page', standalone: true, imports: [PageHeader, EmptyState, Alert, StatTile, MaintBars],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/devices.scss', '../../../shared/styles/maintenance.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="الصيانة" heading="إحصائيات الصيانة" subtitle="أرقام الطلبات والمهام ضمن نطاقك">
  <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" />

      @if (stats(); as s) {
        <section class="stats-4" aria-label="ملخص">
          <app-stat-tile label="طلبات الصيانة" [value]="s.totalRequests" icon="🧾" tone="green" [hint]="s.requestsThisMonth + ' هذا الشهر'" />
          <app-stat-tile label="متوسط مدة الإصلاح" [value]="hours(s.averageRepairHours)" icon="⏱" tone="blue" hint="من بدء العمل إلى الإنجاز" />
          <app-stat-tile label="مهام الصيانة" [value]="s.totalTasks" icon="🛠" tone="purple" [hint]="s.tasksThisMonth + ' هذا الشهر'" />
          <app-stat-tile label="الفنيون" [value]="s.byTechnician.length" icon="👥" tone="orange" hint="لهم طلبات مسجّلة" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الطلبات حسب الحالة</h2></div></div>
          <app-maint-bars [items]="s.byStatus" [limit]="20" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الطلبات المستلمة في آخر 6 أشهر</h2></div></div>
          <div class="months" role="img" [attr.aria-label]="monthsLabel()">
            @for (m of s.monthly; track m.year + '-' + m.month) {
              <div class="month" [attr.title]="monthName(m.month) + ' ' + m.year + ': ' + m.count">
                <span class="n">{{ m.count }}</span>
                <span class="col"><span [style.height.%]="100 * m.count / monthMax()"></span></span>
                <span class="m">{{ monthName(m.month) }}</span>
              </div>
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الطلبات حسب الفني</h2></div></div>
          <app-maint-bars [items]="s.byTechnician" [limit]="12" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>أكثر الأعطال تكراراً</h2></div></div>
          <app-maint-bars [items]="s.byDamageType" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الطلبات حسب نوع الجهاز</h2></div></div>
          <app-maint-bars [items]="s.byDeviceType" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الطلبات حسب الشركة المصنّعة</h2></div></div>
          <app-maint-bars [items]="s.byCompany" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>مهام الصيانة حسب الموظف</h2></div></div>
          <app-maint-bars [items]="s.tasksByUser" [limit]="12" />
        </section>
      } @else if (loading()) { <app-empty-state panel>جارٍ التحميل…</app-empty-state> }
    </div>`,
  styles: [`
    .months { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 14px; align-items: end; height: 220px; }
    .month { display: grid; grid-template-rows: auto 1fr auto; gap: 6px; height: 100%; justify-items: center; min-width: 0; }
    .col { width: min(100%, 56px); display: flex; align-items: flex-end; background: var(--fill); border-radius: var(--radius-md); overflow: hidden; }
    .col span { display: block; width: 100%; min-height: 3px; background: var(--brand-600); border-radius: var(--radius-md) var(--radius-md) 0 0; }
    .n { font-size: 13px; font-weight: 700; color: var(--ink-900); font-variant-numeric: tabular-nums; }
    .m { font-size: 12px; color: var(--ink-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  `]
})
export class MaintenanceStatsPage {
  private service = inject(MaintenanceService);

  stats = signal<MaintenanceStats | null>(null);
  loading = signal(false);
  error = signal('');
  hours = formatHours;

  monthMax = computed(() => Math.max(1, ...(this.stats()?.monthly.map(m => m.count) ?? [])));
  monthsLabel = computed(() => (this.stats()?.monthly ?? []).map(m => `${this.monthName(m.month)}: ${m.count}`).join('، '));

  constructor() {
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType?.startsWith('Maintenance')) this.load();
    });
    this.load();
  }

  monthName(month: number) { return MONTHS[month - 1] ?? ''; }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.stats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
