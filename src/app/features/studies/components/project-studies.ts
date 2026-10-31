import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { StudyItem, StudyInput } from '../data-access/studies.models';
import { StudiesService } from '../data-access/studies.service';
import { StudyFormDialog } from './study-form-dialog';

/** تبويب «الدراسة» في إضبارة المشروع: أوامر الدراسة المفتوحة عليه بحالتها وتقدّم مخرجاتها، وزر فتح أمر جديد لمن يملك صلاحيته */
@Component({
  selector: 'app-project-studies', standalone: true,
  imports: [DatePipe, RouterLink, Alert, EmptyState, UtcPipe, StudyFormDialog],
  styleUrls: ['../../../shared/styles/data-tools.scss'],
  styles: [`:host { display: block; min-width: 0; } td small { display: block; color: var(--ink-500); font-size: 12px; } .late { color: var(--danger, #c0392b); font-weight: 700; }`],
  template: `
    <section class="panel">
      <div class="panel-heading"><h2>الدراسات <span class="count">({{ total() }})</span></h2>
        @if (access().canCreate && !finished()) { <button class="btn" type="button" (click)="dialog.set(true)">+ أمر دراسة</button> }</div>
      <app-alert [message]="error()" />
      @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else if (!items().length) { <app-empty-state>لا أوامر دراسة على هذا المشروع ضمن صلاحياتك{{ access().canCreate && !finished() ? ' — افتح أمراً بزر «+ أمر دراسة»' : '' }}</app-empty-state> }
      @else {
        <div class="table-wrap"><table>
          <thead><tr><th>الرقم</th><th>العنوان</th><th>الحالة</th><th>المخرجات</th><th>الموعد</th></tr></thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr>
                <td class="num" dir="ltr"><a [routerLink]="['/studies', s.id]">{{ s.number }}</a></td>
                <td class="cell-strong">{{ s.title }}<small>{{ s.modeAr }}</small></td>
                <td>{{ s.statusAr }}@if (s.isOverdue) { <small class="late">فيه مخرج متأخر</small> }</td>
                <td>{{ s.deliverablesApproved }} / {{ s.deliverablesTotal }}</td>
                <td>{{ s.dueDate ? (s.dueDate | utc | date:'yyyy/MM/dd') : '—' }}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </section>

    @if (dialog()) {
      <app-study-form-dialog [projectId]="projectId()" [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class ProjectStudies {
  private service = inject(StudiesService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  projectId = input.required<number>();
  /** مشروع مغلق أو ملغى: لا أوامر جديدة (يرفضها الخادم أيضاً) */
  finished = input(false);

  access = this.service.access;
  items = signal<StudyItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.latest(this.service.search({ projectId, status: null, search: '', overdueOnly: false, mine: false, page: 1, pageSize: 50 }),
        this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
    });
  }

  create(body: StudyInput) {
    trackRequest(this.service.create(body), this.saving, this.formError, s => {
      this.dialog.set(false);
      this.toast.success(`فُتح أمر الدراسة ${s.number}`);
      void this.router.navigate(['/studies', s.id]);
    });
  }
}
