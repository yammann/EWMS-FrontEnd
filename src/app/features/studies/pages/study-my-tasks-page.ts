import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { StudyProgress } from '../components/progress-bar';
import { StudyStatusChip } from '../components/study-status-chip';
import { StudyTaskProgressDialog } from '../components/task-progress-dialog';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StageTask } from '../data-access/studies.models';

const PAGE_SIZE = 20;
const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';

/**
 * مهامي في مشاريع الدراسات: المسندة إليّ أو إلى مكتبي أو قسمي، مفتوحة أولاً، مع تحديث الإنجاز من الصفحة نفسها.
 * التحديث لمن تصل إليه المهمة (علم canUpdateProgress)، والخادم يحسب نسبة المرحلة والمشروع.
 */
@Component({
  selector: 'app-study-my-tasks-page',
  standalone: true,
  imports: [RouterLink, PageHeader, Alert, EmptyState, Pager, StudyStatusChip, StudyProgress, StudyTaskProgressDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  styles: [`td small { display: block; color: var(--ink-500); font-size: 12px; } .dim { opacity: .55; transition: opacity .15s; }`],
  template: `
    <div class="page">
      <app-page-header eyebrow="فرع الدراسات" heading="مهامي" subtitle="المهام المسندة إليّ أو إلى مكتبي أو قسمي في مشاريع الدراسات">
        <button class="btn btn-ghost" type="button" (click)="toggle()">{{ openOnly() ? 'عرض كل المهام' : 'المفتوحة فقط' }}</button>
        <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
      </app-page-header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <section class="panel">
        @if (loading() && !rows().length) {
          <app-empty-state>جارٍ التحميل…</app-empty-state>
        } @else if (!rows().length && !error()) {
          <div class="empty-state"><h3>{{ openOnly() ? 'لا مهام مفتوحة' : 'لا مهام' }}</h3><p>تظهر هنا المهام التي تُسنَد إليك في مشاريع الدراسات.</p></div>
        } @else if (rows().length) {
          <div class="table-wrap" [class.dim]="loading()"><table>
            <thead><tr><th>المهمة</th><th>المشروع / المرحلة</th><th>المسندة إلى</th><th>الفترة المخططة</th><th>الإنجاز</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              @for (t of rows(); track t.id) {
                <tr>
                  <td><span class="cell-strong">{{ t.title }}</span>@if (t.description) { <small>{{ t.description }}</small> }</td>
                  <td><a class="mono cell-strong" [routerLink]="['/studies/projects', t.projectId]">{{ t.projectCode }}</a><small>{{ t.stageName }}</small></td>
                  <td>{{ t.targetTypeName }}: {{ t.targetName }}</td>
                  <td class="nowrap">{{ fmt(t.plannedStartDate) }} ← {{ fmt(t.plannedEndDate) }}</td>
                  <td><app-study-progress [percent]="t.progress" /></td>
                  <td><app-study-status-chip kind="progress" [status]="t.status" [name]="t.statusName" /></td>
                  <td>@if (t.canUpdateProgress) { <button type="button" class="btn btn-sm" (click)="editing.set(t)">تحديث الإنجاز</button> }</td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
        }
      </section>
    </div>

    @if (editing(); as t) {
      <app-study-task-progress-dialog [task]="t" (closed)="editing.set(null)" (saved)="saved()" />
    }
  `
})
export class StudyMyTasksPage {
  private service = inject(StudyProjectsService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  pageSize = PAGE_SIZE;
  fmt = day;
  openOnly = signal(true);
  rows = signal<StageTask[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');
  editing = signal<StageTask | null>(null);

  constructor() { this.load(); }

  toggle() { this.openOnly.update(v => !v); this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    this.latest(this.service.myTasks(this.openOnly(), this.page(), PAGE_SIZE), this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }

  saved() { this.editing.set(null); this.toast.success('حُدّث الإنجاز'); this.load(); }
}
