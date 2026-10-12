import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon, IconName } from '@shared/ui/icon';
import { PageHeader } from '@shared/ui/page-header';
import { latestRequest } from '@shared/ui/track-request';
import { ReportService } from '../data-access/report.service';
import { ReportInfo } from '../data-access/report.models';

/** أيقونة كل مجموعة تقارير (المجموعات من الخادم؛ غير المعروفة بأيقونة عامة) */
const GROUP_ICONS: Record<string, IconName> = {
  'الإجازات': 'beach',
  'الموظفون والهيكل': 'users',
  'الصيانة وقطع الغيار': 'wrench',
  'الأجهزة والخريطة': 'map'
};

/**
 * مركز التقارير (2026-10-12): بطاقات التقارير التي يملك المستخدم صلاحية سحبها، مجمّعة كما يرتّبها الخادم.
 * كل تقرير يُفتح في صفحته: فلاتر ← معاينة ← Excel أو طباعة A4.
 */
@Component({
  selector: 'app-reports-page', standalone: true, imports: [PageHeader, Alert, EmptyState, RouterLink, Icon],
  styleUrls: ['../../../shared/styles/page-base.scss'],
  template: `
    <div class="page">
      <app-page-header eyebrow="التقارير" heading="مركز التقارير" subtitle="اختر تقريراً وحدّد فلاتره، ثم عاينه أو نزّله Excel أو اطبعه. كل تنزيل وطباعة يُسجَّل.">
        @if (canLog()) { <a class="btn btn-ghost" routerLink="/reports/log"><app-icon name="clock" [size]="16" /> سجل السحب</a> }
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (loading() && !reports().length) { <p class="muted" role="status">جارٍ التحميل…</p> }

      @for (g of groups(); track g.title) {
        <section class="group" [attr.aria-labelledby]="'group-' + $index">
          <h2 [id]="'group-' + $index"><app-icon [name]="g.icon" [size]="18" /> {{ g.title }}</h2>
          <div class="report-cards">
            @for (r of g.reports; track r.key) {
              <a class="report-card" [routerLink]="['/reports', r.key]">
                <strong>{{ r.title }}</strong>
                <span>{{ r.description }}</span>
                <small><app-icon name="table" [size]="13" /> Excel <span aria-hidden="true">·</span> <app-icon name="printer" [size]="13" /> طباعة {{ r.landscape ? 'بالعرض' : 'بالطول' }}</small>
              </a>
            }
          </div>
        </section>
      } @empty {
        @if (!loading() && !error()) {
          <app-empty-state panel>لا توجد تقارير مسموحة لك — صلاحيات السحب تُمنح من صفحة الأدوار (قسم «التقارير»)</app-empty-state>
        }
      }
    </div>`,
  styles: [`
    .group { display: grid; gap: 12px; }
    .group h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; color: var(--ink-800); }
    .group h2 app-icon { color: var(--brand-600); }
    .report-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .report-card { display: grid; align-content: start; gap: 8px; padding: 18px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--separator);
      color: inherit; text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
    .report-card:hover { border-color: var(--brand-300); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
    .report-card:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .report-card strong { font-size: 15px; color: var(--ink-900); }
    .report-card span { color: var(--ink-500); font-size: 13px; line-height: 1.8; }
    .report-card small { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-400); font-size: 12px; }
    @media (prefers-reduced-motion: reduce) { .report-card { transition: none; } .report-card:hover { transform: none; } }
  `]
})
export class ReportsPage {
  private service = inject(ReportService);
  private auth = inject(AuthService);
  private latest = latestRequest();

  reports = signal<ReportInfo[]>([]);
  loading = signal(false);
  error = signal('');
  canLog = computed(() => this.auth.hasPermission(AppPermission.ViewReportLog));

  groups = computed(() => {
    const map = new Map<string, ReportInfo[]>();
    for (const r of this.reports()) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return [...map].map(([title, reports]) => ({ title, reports, icon: GROUP_ICONS[title] ?? 'docText' }));
  });

  constructor() { this.load(); }

  load() { this.latest(this.service.catalog(), this.loading, this.error, r => this.reports.set(r)); }
}
