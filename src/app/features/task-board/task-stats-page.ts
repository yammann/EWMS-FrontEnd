import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignedTaskService } from '@core/services/assigned-task.service';
import { TaskStats } from '@core/models/assigned-task.models';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * إحصائيات المهام لمن يملك ViewTaskStats، ضمن مهام نطاقه فقط: الإنجاز في الموعد، متوسط زمن التنفيذ، المتأخرات،
 * وجدول لكل جهة (قسم/مكتب/موظف) وحركة الأشهر. الفترة تُحسب على تاريخ إنشاء المهمة.
 */
@Component({
  selector: 'app-task-stats-page', standalone: true, imports: [EmptyState, Alert, FormsModule, StatTile],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', '../maintenance/maintenance.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">إدارة المهام</span><h1>إحصائيات المهام</h1><p class="muted">أداء الجهات ضمن نطاقك — المهام التي أُنشئت خلال الفترة المحددة</p></div>
        <div class="header-actions"><button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button></div>
      </header>

      <div class="range">
        <label>من <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" [max]="to()"></label>
        <label>إلى <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" [min]="from()"></label>
        <button type="button" class="btn btn-sm" (click)="load()" [disabled]="loading()">عرض</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="preset(30)">30 يوماً</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="preset(90)">3 أشهر</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="preset(365)">سنة</button>
      </div>

      <app-alert [message]="error()" />

      @if (stats(); as s) {
        <section class="stats-4" aria-label="ملخص">
          <app-stat-tile label="المهام" [value]="s.total" icon="🗂️" tone="blue" [hint]="s.done + ' منجزة · ' + s.open + ' مفتوحة'" />
          <app-stat-tile label="الإنجاز في الموعد" [value]="rate(s.onTimeRate)" icon="🎯" tone="green" hint="من المنجزة ذات الموعد" />
          <app-stat-tile label="متوسط زمن التنفيذ" [value]="s.avgDays === null ? '—' : s.avgDays + ' يوم'" icon="⏱" tone="purple" hint="من الإسناد إلى الإنجاز" />
          <app-stat-tile label="متأخرة الآن" [value]="s.overdue" icon="⏰" tone="red" [alert]="s.overdue > 0"
            [hint]="s.returnedTasks ? 'أُعيدت ' + s.returnedTasks + ' مهمة من المراجعة' : 'لم تُعَد مهام من المراجعة'" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>حسب الجهة المنفِّذة</h2><p class="muted">مرتبة بالأكثر تأخراً ثم الأكثر مهاماً</p></div></div>
          @if (s.byTarget.length) {
            <div class="table-scroll">
              <table>
                <thead><tr><th>الجهة</th><th>الإجمالي</th><th>منجزة</th><th>مفتوحة</th><th>متأخرة</th><th>في الموعد</th><th>متوسط الأيام</th><th>مرات الإعادة</th></tr></thead>
                <tbody>
                  @for (g of s.byTarget; track g.targetType + g.name) {
                    <tr>
                      <td><strong>{{ g.name }}</strong> <small class="muted">{{ g.targetTypeAr }}</small></td>
                      <td>{{ g.total }}</td><td>{{ g.done }}</td><td>{{ g.open }}</td>
                      <td [class.late]="g.overdue > 0">{{ g.overdue }}</td>
                      <td>{{ rate(g.onTimeRate) }}</td><td>{{ g.avgDays ?? '—' }}</td><td>{{ g.returned }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <p class="muted">لا توجد مهام في هذه الفترة.</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>حركة الأشهر</h2><p class="muted">المُنشأ والمُنجز من مهام الفترة</p></div></div>
          <div class="months" role="img" [attr.aria-label]="monthsLabel()">
            @for (m of s.byMonth; track m.month) {
              <div class="month" [attr.title]="monthName(m.month) + ': أُنشئت ' + m.created + '، أُنجزت ' + m.done">
                <span class="n">{{ m.created }} / {{ m.done }}</span>
                <span class="cols">
                  <span class="col created"><span [style.height.%]="100 * m.created / monthMax()"></span></span>
                  <span class="col done"><span [style.height.%]="100 * m.done / monthMax()"></span></span>
                </span>
                <span class="m">{{ monthName(m.month) }}</span>
              </div>
            }
          </div>
          <p class="legend"><span class="sw created"></span> أُنشئت <span class="sw done"></span> أُنجزت</p>
        </section>
      } @else if (loading()) { <app-empty-state panel>جارٍ التحميل…</app-empty-state> }
    </div>`,
  styles: [`
    .range { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .range label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-600); font-weight: 700; }
    .range input { width: auto; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; min-width: 640px; }
    td.late { color: var(--danger-600); font-weight: 800; }
    .months { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 14px; align-items: end; height: 220px; }
    .month { display: grid; grid-template-rows: auto 1fr auto; gap: 6px; height: 100%; justify-items: center; min-width: 0; }
    .cols { display: flex; align-items: stretch; gap: 4px; width: min(100%, 64px); }
    .col { flex: 1; display: flex; align-items: flex-end; background: var(--fill); border-radius: var(--radius-sm); overflow: hidden; }
    .col span { display: block; width: 100%; min-height: 3px; border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
    .col.created span { background: var(--info-500); }
    .col.done span { background: var(--brand-600); }
    .n { font-size: 12px; font-weight: 700; color: var(--ink-900); font-variant-numeric: tabular-nums; }
    .m { font-size: 12px; color: var(--ink-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .legend { display: flex; align-items: center; gap: 8px; margin: 14px 0 0; font-size: 12px; color: var(--ink-500); }
    .sw { width: 10px; height: 10px; border-radius: 3px; margin-inline-start: 10px; }
    .sw.created { background: var(--info-500); }
    .sw.done { background: var(--brand-600); }
  `]
})
export class TaskStatsPage {
  private service = inject(AssignedTaskService);

  from = signal(iso(new Date(Date.now() - 90 * 86_400_000)));
  to = signal(iso(new Date()));
  stats = signal<TaskStats | null>(null);
  loading = signal(false);
  error = signal('');

  monthMax = computed(() => Math.max(1, ...(this.stats()?.byMonth.flatMap(m => [m.created, m.done]) ?? [])));
  monthsLabel = computed(() => (this.stats()?.byMonth ?? []).map(m => `${this.monthName(m.month)}: أُنشئت ${m.created}، أُنجزت ${m.done}`).join('، '));

  constructor() { this.load(); }

  rate = (v: number | null) => v === null ? '—' : `${v}%`;
  monthName(month: string) { const [y, m] = month.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; }

  preset(days: number) {
    this.to.set(iso(new Date()));
    this.from.set(iso(new Date(Date.now() - days * 86_400_000)));
    this.load();
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.stats(this.from(), this.to()).subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
