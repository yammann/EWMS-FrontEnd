import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { NotificationService } from '@core/services/notification.service';
import { MaintenanceRequest, MaintenanceTransfer, TechnicianOption } from '../data-access/maintenance.models';
import { ToastService } from '@shared/ui/toast.service';
import { Modal } from '@shared/ui/modal';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

/**
 * طلب تحويل طلب صيانة (قرار المستخدم 2026-10-05) — في صفحة الطلب:
 * - الفني المسند إليه (canRequestTransfer): زر «طلب تحويل» ← السبب + اقتراح زميل اختياري.
 * - إن وُجد طلب معلّق: شريط بتفاصيله؛ ومن يملك نقل طلبات القسم (canAssign) يقبل (يختار الموظف، المقترح مختار مسبقاً) أو يرفض بملاحظة.
 */
@Component({
  selector: 'app-transfer-panel', standalone: true, imports: [FormActions, Alert, UtcPipe, DatePipe, Modal],
  templateUrl: './transfer-panel-transfer-panel.html',
  styleUrl: './transfer-panel-transfer-panel.scss'
})
export class TransferPanel {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);

  request = input.required<MaintenanceRequest>();
  /** بعد إرسال طلب أو قرار — تعيد الصفحة تحميل الطلب */
  changed = output<void>();

  pending = signal<MaintenanceTransfer | null>(null);
  assignees = signal<TechnicianOption[]>([]);
  colleagues = signal<TechnicianOption[]>([]);
  target = signal(0);
  note = signal('');
  reason = signal('');
  suggested = signal(0);
  askOpen = signal(false);
  busy = signal(false);
  error = signal('');

  canDecide = () => this.service.can().assignRequest && this.request().canAssign;

  constructor() {
    // كلما تغيّر الطلب (تحميل/قرار/نقل) يُعاد جلب طلب التحويل المعلّق
    toObservable(this.request).pipe(
      switchMap(r => this.service.pendingTransfer(r.id).pipe(catchError(() => of(null)))),
      takeUntilDestroyed()
    ).subscribe(t => {
      this.pending.set(t ?? null);
      this.target.set(t?.suggestedUserId ?? 0);
      if (t && this.canDecide() && !this.assignees().length)
        this.service.assignees(this.request().departmentId).subscribe({ next: l => this.assignees.set(l), error: () => { } });
    });

    // إشعار قرار/طلب تحويل على هذا الطلب يعيد التحميل
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MaintenanceRequest' && n.relatedEntityId === this.request().id) this.changed.emit();
    });
  }

  openAsk() {
    this.reason.set(''); this.suggested.set(0); this.error.set('');
    this.askOpen.set(true);
    if (!this.colleagues().length)
      this.service.transferColleagues().subscribe({ next: l => this.colleagues.set(l), error: () => { } });
  }

  ask() {
    if (!this.reason().trim() || this.busy()) return;
    trackRequest(this.service.requestTransfer(this.request().id, { reason: this.reason().trim(), suggestedUserId: this.suggested() || null }), this.busy, this.error, () => { this.askOpen.set(false); this.toast.success('أُرسل طلب التحويل إلى رئيس القسم'); this.changed.emit(); });
  }

  decide(approve: boolean) {
    const t = this.pending(); if (!t || this.busy()) return;
    trackRequest(this.service.decideTransfer(t.id, { approve, userId: approve ? this.target() : null, note: this.note().trim() || null }), this.busy, this.error, () => { this.note.set(''); this.toast.success(approve ? 'نُقل الطلب' : 'رُفض طلب التحويل'); this.changed.emit(); });
  }
}

/** زر «طلبات تحويل بانتظارك (N)» في صفحة طلبات الصيانة — لمن يملك نقل طلبات القسم */
@Component({
  selector: 'app-pending-transfers-button', standalone: true, imports: [UtcPipe, DatePipe, RouterLink, Modal],
  template: `
    @if (items().length) {
      <button type="button" class="btn btn-warn" (click)="open.set(true)">طلبات تحويل بانتظارك ({{ items().length }})</button>
    }
    @if (open()) {
      <app-modal heading="طلبات التحويل بانتظار قرارك" subheading="افتح الطلب لقبول التحويل أو رفضه" size="lg" (closed)="open.set(false)">
        <div class="modal-body">
          <div class="table-wrap"><table>
            <thead><tr><th>الطلب</th><th>من</th><th>المقترح</th><th>السبب</th><th>التاريخ</th></tr></thead>
            <tbody>
              @for (t of items(); track t.id) {
                <tr>
                  <td><a class="number mono" [routerLink]="['/maintenance/requests', t.maintenanceRequestId]" (click)="open.set(false)">{{ t.requestNumber }}</a><small>{{ t.clientName }}</small></td>
                  <td>{{ t.requestedByName }}</td>
                  <td>{{ t.suggestedUserName || '—' }}</td>
                  <td class="wrap">{{ t.reason }}</td>
                  <td class="nowrap">{{ t.createdAt | utc | date:'yyyy/MM/dd' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="open.set(false)">إغلاق</button></footer>
      </app-modal>
    }`,
  styles: [`.btn-warn { background: var(--accent); color: var(--on-brand); }`]
})
export class PendingTransfersButton {
  private service = inject(MaintenanceService);
  items = signal<MaintenanceTransfer[]>([]);
  open = signal(false);

  constructor() {
    this.load();
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'MaintenanceRequest') this.load();
    });
  }

  load() { this.service.pendingTransfers().subscribe({ next: l => this.items.set(l), error: () => { } }); }
}
