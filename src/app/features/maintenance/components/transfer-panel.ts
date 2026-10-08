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

/**
 * طلب تحويل طلب صيانة (قرار المستخدم 2026-10-05) — في صفحة الطلب:
 * - الفني المسند إليه (canRequestTransfer): زر «طلب تحويل» ← السبب + اقتراح زميل اختياري.
 * - إن وُجد طلب معلّق: شريط بتفاصيله؛ ومن يملك نقل طلبات القسم (canAssign) يقبل (يختار الموظف، المقترح مختار مسبقاً) أو يرفض بملاحظة.
 */
@Component({
  selector: 'app-transfer-panel', standalone: true, imports: [Alert, UtcPipe, DatePipe, Modal],
  template: `
    @if (pending(); as t) {
      <section class="panel transfer" role="status">
        <div class="head">
          <span class="badge">طلب تحويل</span>
          <div>
            <strong>{{ t.requestedByName }} يطلب تحويل هذا الطلب{{ t.suggestedUserName ? ' إلى ' + t.suggestedUserName : '' }}</strong>
            <small>{{ t.createdAt | utc | date:'yyyy/MM/dd — HH:mm' }} · {{ t.statusAr }}</small>
          </div>
        </div>
        <p class="reason"><b>السبب:</b> {{ t.reason }}</p>

        @if (canDecide()) {
          <app-alert [message]="error()" />
          <div class="decide">
            <label class="form-field"><span class="form-label">يُحوَّل إلى</span>
              <select [value]="target()" (change)="target.set(+$any($event.target).value)" [disabled]="busy()">
                <option [value]="0">اختر الموظف</option>
                @for (u of assignees(); track u.id) {
                  <option [value]="u.id" [selected]="u.id === target()" [disabled]="u.id === request().userId">{{ u.fullName }}{{ u.id === request().userId ? ' (الحالي)' : '' }}{{ u.id === t.suggestedUserId ? ' — المقترح' : '' }}</option>
                }
              </select>
            </label>
            <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span>
              <input [value]="note()" (input)="note.set($any($event.target).value)" maxlength="500" [disabled]="busy()">
            </label>
          </div>
          <div class="actions">
            <button type="button" class="btn" (click)="decide(true)" [disabled]="busy() || !target() || target() === request().userId">قبول ونقل الطلب</button>
            <button type="button" class="btn btn-danger" (click)="decide(false)" [disabled]="busy()">رفض</button>
          </div>
        } @else {
          <p class="muted">بانتظار قرار رئيس القسم.</p>
        }
      </section>
    } @else if (request().canRequestTransfer) {
      <div class="ask-row">
        <button type="button" class="btn btn-ghost btn-sm" (click)="openAsk()">طلب تحويل إلى موظف آخر</button>
      </div>
    }

    @if (askOpen()) {
      <app-modal heading="طلب تحويل الطلب" [subheading]="request().number + ' — يقرّره رئيس القسم'" [busy]="busy()" (closed)="askOpen.set(false)">
        <form (submit)="$event.preventDefault(); ask()">
          <div class="modal-body form-stack">
            <app-alert [message]="error()" />
            <label class="form-field"><span class="form-label">سبب التحويل</span>
              <textarea rows="3" maxlength="500" [value]="reason()" (input)="reason.set($any($event.target).value)" placeholder="مثلاً: العطل خارج اختصاصي، أو لدي إجازة"></textarea>
            </label>
            <label class="form-field"><span class="form-label">زميل مقترح <small class="hint">(اختياري)</small></span>
              <select (change)="suggested.set(+$any($event.target).value)">
                <option [value]="0">بلا اقتراح — يختار رئيس القسم</option>
                @for (u of colleagues(); track u.id) { <option [value]="u.id">{{ u.fullName }}</option> }
              </select>
            </label>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="askOpen.set(false)" [disabled]="busy()">إلغاء</button>
            <button type="submit" [disabled]="busy() || !reason().trim()">{{ busy() ? 'جارٍ الإرسال…' : 'إرسال الطلب' }}</button>
          </footer>
        </form>
      </app-modal>
    }`,
  styles: [`
    .transfer { border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
    .head { display: flex; align-items: flex-start; gap: 12px; }
    .head div { display: grid; gap: 2px; }
    .head small { color: var(--ink-500); font-size: 12px; }
    .badge { flex: none; padding: 3px 10px; border-radius: 999px; background: var(--accent); color: var(--on-brand); font-size: 12px; font-weight: 700; }
    .reason { margin: 10px 0; white-space: pre-line; }
    .decide { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .muted { margin: 0; color: var(--ink-500); font-size: 13px; }
    .ask-row { display: flex; justify-content: flex-end; margin: -6px 0 12px; }
    @media (max-width: 720px) { .decide { grid-template-columns: 1fr; } }
  `]
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
