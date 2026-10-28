import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state';
import { latestRequest } from '@shared/ui/track-request';
import { CorrespondenceItem } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

/**
 * معاملات المشروع في إضبارته: الوارد والصادر المربوطان به ضمن ما يراه المستخدم من معاملات (حدّ الرؤية يطبّقه الخادم).
 * يظهر تبويبها لمن يملك صلاحيات الديوان؛ الربط من نموذج المعاملة نفسه (حقل «المشروع»).
 */
@Component({
  selector: 'app-project-correspondence', standalone: true, imports: [DatePipe, RouterLink, UtcPipe, EmptyState],
  styleUrls: ['../../../shared/styles/data-tools.scss'],
  styles: [`:host { display: block; min-width: 0; } td small { display: block; color: var(--ink-500); font-size: 12px; } .late { color: var(--danger, #c0392b); font-weight: 700; }`],
  template: `
    <section class="panel">
      <div class="panel-heading"><h2>المعاملات <span class="count">({{ total() }})</span></h2></div>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else if (!items().length) { <app-empty-state>لا معاملات مربوطة بهذا المشروع ضمن صلاحياتك — اربط معاملة به من حقل «المشروع» في نموذجها</app-empty-state> }
      @else {
        <div class="table-wrap"><table>
          <thead><tr><th>الرقم</th><th>الموضوع</th><th>الجهة</th><th>الحالة</th><th>سُجّلت</th></tr></thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr>
                <td class="num" dir="ltr"><a [routerLink]="['/diwan', c.id]">{{ c.number || 'مسودة' }}</a><small>{{ c.directionAr }}</small></td>
                <td class="cell-strong">{{ c.subject }}</td>
                <td>{{ c.party }}</td>
                <td>{{ c.direction === 1 ? c.statusName : c.outgoingStateAr }}@if (c.isOverdue) { <small class="late">متأخرة</small> }</td>
                <td>{{ c.registeredAt | utc | date:'yyyy/MM/dd' }}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </section>
  `
})
export class ProjectCorrespondence {
  private service = inject(DiwanService);
  private latest = latestRequest();

  projectId = input.required<number>();
  items = signal<CorrespondenceItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.latest(this.service.search({
        direction: null, typeId: null, statusId: null, stage: null, projectId, search: '', from: '', to: '', overdueOnly: false, inbox: false, page: 1, pageSize: 50
      }), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
    });
  }
}
