import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LinkedTasks } from '@features/task-board';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { AGREEMENT_STATUS, Agreement, AgreementInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { AgreementFormDialog } from '../components/agreement-form-dialog';

type Tab = 'main' | 'tasks';
type Dialog = 'edit' | 'submit' | 'approve' | 'return' | 'cancel';

/**
 * صفحة محضر الاتفاق: مسوّدة ← مرسَل للاعتماد ← معتمد أو معاد للتصحيح. من أعدّ المحضر لا يعتمده (حتى لو كان مدير النظام)،
 * والأزرار كلها تتبع أعلام الخادم. الإجمالي بعملة المحضر وحدها.
 */
@Component({
  selector: 'app-agreement-page', standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, LinkedTasks, AgreementFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-request-page.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          @if (agreement(); as a) {
            <span class="eyebrow">محضر اتفاق@if (a.projectId) { · <a [routerLink]="['/projects', a.projectId]">{{ a.projectName }}</a> }</span>
          } @else { <span class="eyebrow">محضر اتفاق</span> }
          <h1>{{ agreement()?.internalNumber || (loading() ? 'جارٍ التحميل…' : 'محضر الاتفاق') }}</h1>
          @if (agreement(); as a) {
            <p class="muted"><strong>{{ a.supplierName }}</strong> · <span class="pill">{{ a.statusAr }}</span>
              @if (a.number) { · الرقم الرسمي <span dir="ltr">{{ a.number }}</span> }
              @if (a.pricingRequestId) { · <a [routerLink]="['/pricing', a.pricingRequestId]">طلب التسعير</a> }
              @if (a.contractId) { · <a [routerLink]="['/contracts', a.contractId]">العقد</a> }</p>
          }
        </div>
        <div class="header-actions">
          @if (agreement(); as a) {
            @if (a.canSubmit) { <button class="btn" type="button" (click)="open('submit')">إرسال للاعتماد</button> }
            @if (a.canReview) {
              <button class="btn" type="button" (click)="open('approve')">اعتماد</button>
              <button class="btn btn-ghost" type="button" (click)="open('return')">إعادة للتصحيح</button>
            }
            @if (a.canEdit) { <button class="btn btn-ghost" type="button" (click)="open('edit')">تعديل</button> }
            @if (a.canCancel) { <button class="btn btn-ghost" type="button" (click)="open('cancel')">إلغاء المحضر</button> }
          }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (agreement(); as a) {
        @if (a.status === st.returned) { <p class="notice warn" role="status">أُعيد للتصحيح: {{ a.returnNote }}</p> }
        @else if (a.status === st.submitted) { <p class="notice" role="status">بانتظار الاعتماد من غير من أعدّه ({{ a.preparedByName }}).</p> }
        @else if (a.status === st.cancelled) { <p class="notice" role="status">محضر ملغى: للقراءة.</p> }

        <nav class="tabs" role="tablist" aria-label="أقسام المحضر">
          @for (t of tabs; track t.key) {
            <button type="button" role="tab" class="tab" [class.active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="select(t.key)">{{ t.label }}</button>
          }
        </nav>

        @switch (tab()) {
          @case ('main') {
            <section class="panel">
              <div class="panel-heading"><h2>بيانات المحضر</h2></div>
              <dl class="facts">
                <div><dt>التاريخ</dt><dd>{{ a.agreementDate | utc | date:'yyyy/MM/dd' }}</dd></div>
                <div><dt>أعدّه</dt><dd>{{ a.preparedByName }} · {{ a.createdAt | utc | date:'yyyy/MM/dd' }}</dd></div>
                @if (a.submittedAt) { <div><dt>أُرسل للاعتماد</dt><dd>{{ a.submittedAt | utc | date:'yyyy/MM/dd' }}</dd></div> }
                @if (a.approvedByName) { <div><dt>اعتمده</dt><dd>{{ a.approvedByName }} · {{ a.approvedAt | utc | date:'yyyy/MM/dd' }}</dd></div> }
                <div><dt>الإجمالي</dt><dd>{{ a.total | number:'1.0-2' }} {{ a.currency }}</dd></div>
              </dl>
              @if (a.approvalNote) { <p class="pre"><strong>ملاحظة الاعتماد:</strong> {{ a.approvalNote }}</p> }
            </section>

            <section class="panel">
              <div class="panel-heading"><h2>البنود <span class="count">({{ a.lines.length }})</span></h2></div>
              <div class="table-wrap"><table>
                <thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                <tbody>
                  @for (l of a.lines; track l.id) {
                    <tr><td>{{ $index + 1 }}</td><td>{{ l.description }}</td><td>{{ l.quantity | number:'1.0-3' }}</td><td>{{ l.unit }}</td><td>{{ l.unitPrice | number:'1.0-4' }}</td><td>{{ l.total | number:'1.0-2' }} {{ a.currency }}</td></tr>
                  }
                </tbody>
              </table></div>
            </section>

            @if (a.technicalSpecs || a.executionMethod || a.notes) {
              <section class="panel">
                @if (a.technicalSpecs) { <p class="pre"><strong>المواصفات الفنية:</strong> {{ a.technicalSpecs }}</p> }
                @if (a.executionMethod) { <p class="pre"><strong>طريقة التنفيذ:</strong> {{ a.executionMethod }}</p> }
                @if (a.notes) { <p class="pre"><strong>ملاحظات:</strong> {{ a.notes }}</p> }
              </section>
            }
          }
          @case ('tasks') {
            <app-linked-tasks entityType="PricingAgreement" [entityId]="a.id" />
            <section class="panel"><p class="muted">تظهر هنا مهام لوحة المهام المرتبطة بهذا المحضر. اربط مهمة به من «الروابط» في نافذة المهمة بكتابة رقمه <span dir="ltr">{{ a.internalNumber }}</span>.</p></section>
          }
        }
      } @else if (loading()) {
        <app-empty-state>جارٍ التحميل…</app-empty-state>
      }
    </div>

    @if (dialog(); as d) {
      @switch (d) {
        @case ('edit') { <app-pricing-agreement-form-dialog [agreement]="agreement()" [busy]="saving()" [error]="formError()" (submitted)="save($event)" (closed)="dialog.set(null)" /> }

        @case ('submit') {
          <app-modal heading="إرسال المحضر للاعتماد" [subheading]="agreement()!.internalNumber" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" /><p class="muted">بعد الإرسال لا يُعدَّل المحضر حتى يُعاد للتصحيح، ولا يعتمده من أعدّه.</p></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">رجوع</button><button type="button" (click)="submit()" [disabled]="saving()">إرسال</button></footer>
          </app-modal>
        }

        @case ('approve') {
          <app-modal heading="اعتماد المحضر" [subheading]="agreement()!.internalNumber" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" />
              <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="2000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="review(true)" [disabled]="saving()">اعتماد</button></footer>
          </app-modal>
        }

        @case ('return') {
          <app-modal heading="إعادة المحضر للتصحيح" [subheading]="agreement()!.internalNumber" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" />
              <label class="form-field"><span class="form-label">ما المطلوب تصحيحه</span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="2000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="review(false)" [disabled]="saving()">إعادة</button></footer>
          </app-modal>
        }

        @case ('cancel') {
          <app-modal heading="إلغاء محضر الاتفاق" [subheading]="agreement()!.internalNumber" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack"><app-alert [message]="formError()" /><p class="muted">يبقى الأثر ولا يُحذف المحضر.</p>
              <label class="form-field"><span class="form-label">السبب <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label></div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">رجوع</button><button type="button" (click)="cancel()" [disabled]="saving()">إلغاء المحضر</button></footer>
          </app-modal>
        }
      }
    }`
})
export class AgreementPage {
  private service = inject(PricingService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  st = AGREEMENT_STATUS;
  agreement = signal<Agreement | null>(null);
  loading = signal(false);
  error = signal('');

  private tabParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('tab'))), { initialValue: null });
  tabs: { key: Tab; label: string }[] = [{ key: 'main', label: 'المحضر' }, { key: 'tasks', label: 'المهام' }];
  tab = computed<Tab>(() => this.tabs.find(t => t.key === this.tabParam())?.key ?? 'main');

  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');
  note = '';

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.agreement()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.getAgreement(id), this.loading, this.error, a => this.agreement.set(a));
  }

  select(tab: Tab) { void this.router.navigate([], { queryParams: { tab: tab === 'main' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true }); }

  private done(message: string) {
    return (a: Agreement) => { this.agreement.set(a); this.dialog.set(null); this.toast.success(message); };
  }

  open(dialog: Dialog) { this.formError.set(''); this.note = ''; this.dialog.set(dialog); }

  save(v: AgreementInput) { const a = this.agreement()!; trackRequest(this.service.updateAgreement(a.id, v), this.saving, this.formError, this.done('حُفظ المحضر')); }
  submit() { const a = this.agreement()!; trackRequest(this.service.submitAgreement(a.id, a.rowVersion), this.saving, this.formError, this.done('أُرسل المحضر للاعتماد')); }

  review(approve: boolean) {
    const a = this.agreement()!;
    if (!approve && !this.note.trim()) { this.formError.set('اكتب ما المطلوب تصحيحه'); return; }
    trackRequest(this.service.reviewAgreement(a.id, approve, this.note, a.rowVersion), this.saving, this.formError, this.done(approve ? 'اعتُمد المحضر' : 'أُعيد المحضر للتصحيح'));
  }

  cancel() { const a = this.agreement()!; trackRequest(this.service.cancelAgreement(a.id, this.note, a.rowVersion), this.saving, this.formError, this.done('أُلغي المحضر')); }
}
