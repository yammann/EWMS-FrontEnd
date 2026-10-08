import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceCount, MaintenanceStats, formatHours } from '../data-access/maintenance.models';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';

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
  styleUrl: './stats-page-maint-bars.scss'
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
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './stats-page-maintenance-stats-page.html',
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
    trackRequest(this.service.stats(), this.loading, this.error, s => { this.stats.set(s); });
  }
}
