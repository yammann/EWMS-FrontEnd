import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ContractInput, ContractItem } from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';
import { ContractFormDialog } from './contract-form-dialog';

/** تبويب «العقود» في إضبارة المشروع: عقود المشروع بحالتها وقيمتها وضمانها، وزر فتح عقد جديد لمن يملك صلاحيته */
@Component({
  selector: 'app-project-contracts', standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, Alert, EmptyState, UtcPipe, ContractFormDialog],
  styleUrls: ['../../../shared/styles/data-tools.scss'],
  styles: [`:host { display: block; min-width: 0; } td small { display: block; color: var(--ink-500); font-size: 12px; } .late { color: var(--danger, #c0392b); font-weight: 700; }`],
  template: `
    <section class="panel">
      <div class="panel-heading"><h2>العقود <span class="count">({{ total() }})</span></h2>
        @if (access().canCreate && !finished()) { <button class="btn" type="button" (click)="dialog.set(true)">+ عقد</button> }</div>
      <app-alert [message]="error()" />
      @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else if (!items().length) { <app-empty-state>لا عقود على هذا المشروع ضمن صلاحياتك{{ access().canCreate && !finished() ? ' — افتح عقداً بزر «+ عقد»' : '' }}</app-empty-state> }
      @else {
        <div class="table-wrap"><table>
          <thead><tr><th>الرقم</th><th>الطبيعة</th><th>الحالة</th><th>المتعاقد معه</th><th>القيمة</th><th>الضمان</th></tr></thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr>
                <td class="num" dir="ltr"><a [routerLink]="['/contracts', c.id]">{{ c.number }}</a>@if (c.officialNumber) { <small>{{ c.officialNumber }}</small> }</td>
                <td>{{ c.methodAr }}</td>
                <td>{{ c.statusAr }}</td>
                <td>{{ c.contractorName || '—' }}</td>
                <td>{{ c.effectiveValue !== null ? (c.effectiveValue | number:'1.0-2') + ' ' + c.currency : '—' }}</td>
                <td>{{ c.warrantyEnd ? (c.warrantyEnd | utc | date:'yyyy/MM/dd') : '—' }}@if (c.warrantyEndingSoon) { <small class="late">ينتهي بعد {{ c.warrantyDaysLeft }} يوم</small> }</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </section>

    @if (dialog()) {
      <app-contract-form-dialog [projectId]="projectId()" [branchId]="branchId()" [busy]="saving()" [error]="formError()" (submitted)="create($event)" (closed)="dialog.set(false)" />
    }`
})
export class ProjectContracts {
  private service = inject(ContractsService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  projectId = input.required<number>();
  branchId = input.required<number>();
  /** مشروع مغلق أو ملغى: لا عقود جديدة (يرفضها الخادم أيضاً) */
  finished = input(false);

  access = this.service.access;
  items = signal<ContractItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.latest(this.service.search({ projectId, status: null, method: null, contractorId: null, search: '', warrantyEndingOnly: false, page: 1, pageSize: 50 }),
        this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
    });
  }

  create(body: ContractInput) {
    trackRequest(this.service.create(body), this.saving, this.formError, c => {
      this.dialog.set(false);
      this.toast.success(`فُتح العقد ${c.number}`);
      void this.router.navigate(['/contracts', c.id]);
    });
  }
}
