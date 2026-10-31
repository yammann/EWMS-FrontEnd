import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { HANDOVER_KINDS, HandoverItem } from '../data-access/handover.models';
import { HandoverService } from '../data-access/handover.service';

/**
 * تبويب «الاستلام» في إضبارة المشروع: محاضر الاستلام (أولي ونهائي) وملاحظاتها المفتوحة، وزر تقديم طلب استلام لمن يملك صلاحيته،
 * وإنذار ما لم يكتمل قبل إغلاق المشروع (استلام نهائي، ملاحظات، محتجز، عقد ساري) — تنبيه لا منع.
 */
@Component({
  selector: 'app-project-handovers', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe],
  styleUrls: ['../../../shared/styles/data-tools.scss'],
  styles: [`:host { display: block; min-width: 0; } td small { display: block; color: var(--ink-500); font-size: 12px; } .late { color: var(--danger, #c0392b); font-weight: 700; }
    .notice { margin: 0 0 16px; padding: 10px 14px; border-radius: var(--radius-md); background: color-mix(in srgb, var(--warning-300, #f5b942) 25%, transparent); }
    .notice ul { margin: 6px 0 0; padding-inline-start: 20px; }`],
  template: `
    @if (warnings().length) {
      <div class="notice" role="status"><strong>قبل إغلاق المشروع (تنبيه لا منع):</strong>
        <ul>@for (w of warnings(); track w) { <li>{{ w }}</li> }</ul></div>
    }
    <section class="panel">
      <div class="panel-heading"><h2>الاستلام والتسليم <span class="count">({{ total() }})</span></h2>
        @if (access().canRequest && !finished()) { <button class="btn" type="button" (click)="open()">+ طلب استلام</button> }</div>
      <app-alert [message]="error()" />
      @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
      @else if (!items().length) { <app-empty-state>لا محاضر استلام على هذا المشروع ضمن صلاحياتك{{ access().canRequest && !finished() ? ' — قدّم طلباً بزر «+ طلب استلام»' : '' }}</app-empty-state> }
      @else {
        <div class="table-wrap"><table>
          <thead><tr><th>الرقم</th><th>النوع</th><th>الحالة</th><th>النتيجة</th><th>الملاحظات</th><th>الطلب</th></tr></thead>
          <tbody>
            @for (h of items(); track h.id) {
              <tr>
                <td class="num" dir="ltr"><a [routerLink]="['/handovers', h.id]">{{ h.number }}</a></td>
                <td>{{ h.kindAr }}</td>
                <td>{{ h.statusAr }}</td>
                <td>{{ h.resultAr || '—' }}</td>
                <td>{{ h.openNotes }} / {{ h.totalNotes }}@if (h.hasOverdueNote) { <small class="late">فيها ملاحظة متأخرة</small> }</td>
                <td>{{ h.requestedAt | utc | date:'yyyy/MM/dd' }}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </section>

    @if (dialog()) {
      <app-modal heading="طلب استلام" size="md" [busy]="saving()" (closed)="dialog.set(false)">
        <form (ngSubmit)="submit()">
          <div class="modal-body form-stack">
            <app-alert [message]="formError()" />
            <label class="form-field"><span class="form-label">نوع الاستلام</span>
              <select name="kind" [(ngModel)]="kind">@for (k of kinds; track k.value) { <option [ngValue]="k.value">{{ k.label }}</option> }</select></label>
            <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span>
              <textarea name="note" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label>
            <small class="hint">يُقدَّم الطلب بعد انتهاء الأعمال؛ يسجّله الديوان ويحيله إلى قسم الإشراف فتُشكَّل اللجنة. طلب واحد غير منتهٍ لكل نوع.</small>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="dialog.set(false)" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="saving()">تقديم الطلب</button>
          </footer>
        </form>
      </app-modal>
    }`
})
export class ProjectHandovers {
  private service = inject(HandoverService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private latest = latestRequest();

  projectId = input.required<number>();
  /** مشروع مغلق أو ملغى: لا طلبات جديدة (يرفضها الخادم أيضاً) */
  finished = input(false);

  access = this.service.access;
  kinds = HANDOVER_KINDS;
  items = signal<HandoverItem[]>([]);
  total = signal(0);
  warnings = signal<string[]>([]);
  loading = signal(false);
  error = signal('');
  dialog = signal(false);
  saving = signal(false);
  formError = signal('');
  kind = 1;
  note = '';

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.latest(this.service.search({ projectId, kind: null, status: null, search: '', openNotesOnly: false, page: 1, pageSize: 50 }),
        this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
      this.service.closureWarnings(projectId).subscribe({ next: w => this.warnings.set(w.warnings), error: () => this.warnings.set([]) });
    });
  }

  open() { this.formError.set(''); this.note = ''; this.kind = 1; this.dialog.set(true); }

  submit() {
    trackRequest(this.service.request({ projectId: this.projectId(), kind: this.kind, contractId: null, correspondenceId: null, note: this.note.trim() || null }),
      this.saving, this.formError, h => {
        this.dialog.set(false);
        this.toast.success(`قُدّم طلب الاستلام ${h.number}`);
        void this.router.navigate(['/handovers', h.id]);
      });
  }
}
