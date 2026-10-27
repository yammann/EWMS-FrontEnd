import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { latestRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { AUDIT_ACTION_LABEL, AuditEntry } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';

const PAGE_SIZE = 20;

/** سجل تدقيق المشروع (للإلحاق فقط): من فعل ماذا ومتى، بتفاصيل «قديم ← جديد» — الأحدث أولاً، بصلاحية ViewProjectAudit */
@Component({
  selector: 'app-project-audit-panel', standalone: true,
  imports: [DatePipe, Alert, EmptyState, Pager, SelectValue, UtcPipe],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <section class="panel">
      <div class="panel-heading">
        <h2>سجل التدقيق <span class="count">({{ total() }})</span></h2>
        <select #t [appSelectValue]="type()" (change)="setType(t.value)" aria-label="نوع السجل">
          <option value="">كل الأحداث</option>
          <option value="Project">المشروع والمشاركون</option>
          <option value="ProjectDocument">الوثائق</option>
          <option value="ProjectDocumentVersion">الإصدارات (رفع واعتماد وفتح)</option>
        </select>
      </div>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else if (!items().length && !error()) { <app-empty-state>لا أحداث مسجّلة</app-empty-state> }
      @else {
        <ol class="timeline">
          @for (a of items(); track a.id) {
            <li>
              <div class="head">
                <span class="pill">{{ label(a.action) }}</span>
                <strong>{{ a.title }}</strong>
              </div>
              @if (a.details) { <pre>{{ a.details }}</pre> }
              <small>{{ a.userName }} · {{ a.createdAt | utc | date:'yyyy/MM/dd — HH:mm' }}</small>
            </li>
          }
        </ol>
        <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
      }
    </section>`,
  styles: [`
    .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .timeline li { padding: 12px 14px; border-radius: var(--radius-md); background: var(--fill); display: grid; gap: 6px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    pre { margin: 0; font: inherit; font-size: 13px; color: var(--ink-700); white-space: pre-wrap; overflow-wrap: anywhere; }
    small { color: var(--ink-500); }
  `]
})
export class ProjectAuditPanel {
  private service = inject(ProjectsService);
  private latest = latestRequest();

  projectId = input.required<number>();
  /** يتغير عند كل تعديل في المشروع أو وثائقه: يُعاد التحميل */
  refreshKey = input(0);

  pageSize = PAGE_SIZE;
  items = signal<AuditEntry[]>([]);
  total = signal(0);
  page = signal(1);
  type = signal('');
  loading = signal(false);
  error = signal('');

  constructor() {
    effect(() => { this.projectId(); this.refreshKey(); untracked(() => { this.page.set(1); this.load(); }); });
  }

  label = (action: string) => AUDIT_ACTION_LABEL[action] ?? action;

  load() {
    this.latest(this.service.audit(this.projectId(), this.type(), this.page(), PAGE_SIZE), this.loading, this.error,
      r => { this.items.set(r.items); this.total.set(r.totalCount); });
  }

  setType(value: string) { this.type.set(value); this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }
}
