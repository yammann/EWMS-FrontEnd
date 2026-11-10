import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { Pager } from '@shared/ui/pager';
import { latestRequest } from '@shared/ui/track-request';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StudyProject } from '../data-access/studies.models';
import { StudyProgress } from './progress-bar';
import { StudyStatusChip } from './study-status-chip';

const PAGE_SIZE = 8;

/**
 * بطاقة «مشاريع الدراسات» في صفحة الموقع: مشاريع هذا الموقع (الخادم يصفّي بـ siteId ويبقي حدّ فرع المستخدم)،
 * كل مشروع بطاقة رابط لصفحته. تُعرض لمن يملك ViewStudyProjects فقط — الصفحة هي التي تقرر ظهورها.
 */
@Component({
  selector: 'app-site-studies-panel',
  standalone: true,
  imports: [DatePipe, RouterLink, Alert, Pager, StudyProgress, StudyStatusChip],
  template: `
    <section class="panel">
      <div class="panel-heading"><div>
        <h2>مشاريع الدراسات @if (total()) { <small class="count">({{ total() }})</small> }</h2>
        <p>مشاريع فرع الدراسات المرتبطة بهذا الموقع — انقر على مشروع لفتح صفحته.</p>
      </div></div>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (loading() && !rows().length) {
        <p class="muted" role="status">جارٍ التحميل…</p>
      } @else if (!rows().length && !error()) {
        <p class="muted">لا مشاريع دراسات في هذا الموقع.</p>
      } @else {
        <ul class="projects">
          @for (p of rows(); track p.id) {
            <li>
              <a class="row" [routerLink]="['/studies/projects', p.id]" [attr.aria-label]="'فتح المشروع ' + p.code">
                <span class="head">
                  <span class="code mono">{{ p.code }}</span>
                  <app-study-status-chip kind="project" [status]="p.status" [name]="p.statusName" />
                </span>
                <span class="name">{{ p.name }}</span>
                <span class="meta">
                  <app-study-progress [percent]="p.progress" [label]="'إنجاز ' + p.code" />
                  <small class="muted">{{ p.plannedStartDate | date:'yyyy/MM/dd' }} ← {{ p.plannedEndDate | date:'yyyy/MM/dd' }}</small>
                </span>
              </a>
            </li>
          }
        </ul>
        <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
      }
    </section>
  `,
  styles: [`
    .count { font-weight: 400; color: var(--ink-500); }
    .projects { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .row { display: grid; gap: 6px; height: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; background: var(--fill); color: inherit; text-decoration: none; transition: background .15s; }
    .row:hover, .row:focus-visible { background: var(--fill-strong); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .code { font-weight: 700; color: var(--brand-700); }
    .row:hover .code { text-decoration: underline; }
    .name { font-size: 14px; color: var(--ink-800); }
    .meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
    .meta app-study-progress { flex: 1; min-width: 140px; }
    .muted { color: var(--ink-500); margin: 0; }
  `]
})
export class SiteStudiesPanel {
  private service = inject(StudyProjectsService);
  private latest = latestRequest();

  siteId = input.required<number>();

  pageSize = PAGE_SIZE;
  rows = signal<StudyProject[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  constructor() {
    // موقع آخر (النقر على نقطة مجاورة في خريطة الصفحة) يبدأ من الصفحة الأولى
    effect(() => { this.siteId(); untracked(() => { this.page.set(1); this.load(); }); });
  }

  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    this.latest(this.service.list({ siteId: this.siteId(), page: this.page(), pageSize: PAGE_SIZE }), this.loading, this.error,
      r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }
}
