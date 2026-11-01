import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { REFERENCE_STATUS, ReferencePrice, ReferencePriceCorrection } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';
import { ReferencePriceFormDialog, ReferencePriceSubmit } from '../components/reference-price-form-dialog';

type Dialog = 'correct' | 'approve';

/**
 * صفحة السعر المرجعي: بياناته ومصدره وحالته وسلسلة تصحيحه، وتاريخ المادة بالوحدة والعملة نفسهما (الأحدث تاريخاً أولاً، بلا إبراز للأعلى أو الأقل).
 * لا تعديل: «تصحيح» ينشئ سجلاً بديلاً. «اعتماد» لغير من أضاف السعر. الأزرار تتبع أعلام الخادم.
 */
@Component({
  selector: 'app-reference-price-page', standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, Alert, EmptyState, Modal, UtcPipe, ReferencePriceFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './pricing-request-page.scss', './pricing-page.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          @if (price(); as p) {
            <span class="eyebrow">الأسعار المرجعية@if (p.projectId) { · <a [routerLink]="['/projects', p.projectId]">{{ p.projectName }}</a> }</span>
          } @else { <span class="eyebrow">الأسعار المرجعية</span> }
          <h1>{{ price()?.number || (loading() ? 'جارٍ التحميل…' : 'سعر مرجعي') }}</h1>
          @if (price(); as p) {
            <p class="muted"><strong>{{ p.itemName }}</strong> · <span class="pill">{{ p.statusAr }}</span>
              @if (p.isLatest) { · <strong class="latest">آخر سعر مسجَّل لهذه المادة</strong> } @else if (p.isLatestForSupplier) { · آخر سعر لهذا المورد }</p>
          }
        </div>
        <div class="header-actions">
          @if (price(); as p) {
            @if (p.canApprove) { <button class="btn" type="button" (click)="open('approve')">اعتماد للاستخدام الحالي</button> }
            @if (p.canCorrect) { <button class="btn btn-ghost" type="button" (click)="open('correct')">تصحيح</button> }
          }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (price(); as p) {
        @if (p.status === st.superseded) { <p class="notice warn" role="status">هذا السعر مُستبدَل بتصحيح: يبقى في التاريخ ولا يُعتمد عليه.@if (p.supersededById) { <a [routerLink]="['/pricing/reference-prices', p.supersededById]"> انتقل إلى البديل {{ p.supersededByNumber }}</a> }</p> }
        @else if (p.status === st.historical) { <p class="notice" role="status">سعر تاريخي بمصدره وتاريخه، لا يُبنى عليه قرار قبل اعتماده للاستخدام الحالي{{ p.canApprove ? ' — اعتمده بزر «اعتماد للاستخدام الحالي».' : '.' }}</p> }

        <section class="panel">
          <div class="panel-heading"><h2>بيانات السعر</h2></div>
          <dl class="facts">
            <div><dt>سعر الوحدة</dt><dd>{{ p.unitPrice | number:'1.0-4' }} {{ p.currency }} / {{ p.unit }}</dd></div>
            <div><dt>تاريخ السعر</dt><dd>{{ p.priceDate | utc | date:'yyyy/MM/dd' }}</dd></div>
            <div><dt>المورد</dt><dd>{{ p.supplierName }}</dd></div>
            <div><dt>الرمز</dt><dd dir="ltr">{{ p.itemCode || '—' }}</dd></div>
            <div><dt>المصدر</dt><dd>{{ p.sourceDocument }}<small>{{ p.sourceAr }}</small></dd></div>
            <div><dt>أضافه</dt><dd>{{ p.createdByName }} · {{ p.createdAt | utc | date:'yyyy/MM/dd' }}</dd></div>
            @if (p.approvedByName) { <div><dt>اعتمده</dt><dd>{{ p.approvedByName }} · {{ p.approvedAt | utc | date:'yyyy/MM/dd' }}</dd></div> }
            @if (p.supersedesId) { <div><dt>يصحّح</dt><dd><a [routerLink]="['/pricing/reference-prices', p.supersedesId]" dir="ltr">{{ p.supersedesNumber }}</a></dd></div> }
          </dl>
          @if (p.specifications) { <p class="pre"><strong>المواصفات:</strong> {{ p.specifications }}</p> }
          @if (p.correctionReason) { <p class="pre"><strong>سبب التصحيح:</strong> {{ p.correctionReason }}</p> }
          @if (p.approvalNote) { <p class="pre"><strong>ملاحظة الاعتماد:</strong> {{ p.approvalNote }}</p> }
          @if (p.notes) { <p class="pre"><strong>ملاحظات:</strong> {{ p.notes }}</p> }
        </section>

        <section class="panel">
          <div class="panel-heading"><h2>تاريخ المادة <span class="count">({{ p.history.length }})</span></h2></div>
          <p class="muted">أسعار «{{ p.itemName }}» بالوحدة ({{ p.unit }}) والعملة ({{ p.currency }}) نفسهما، الأحدث تاريخاً أولاً. المعيار التاريخ لا قيمة السعر؛ ولا تُقارَن أسعار بوحدة أو عملة أخرى.</p>
          <div class="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>المورد</th><th>السعر</th><th>التاريخ</th><th>المصدر</th><th>الحالة</th></tr></thead>
            <tbody>
              @for (h of p.history; track h.id) {
                <tr class="row-link" [class.selected]="h.id === p.id" tabindex="0" (click)="goTo(h.id)" (keydown.enter)="goTo(h.id)">
                  <td class="num" dir="ltr">{{ h.number }}</td>
                  <td>{{ h.supplierName }}</td>
                  <td>{{ h.unitPrice | number:'1.0-4' }} {{ h.currency }}</td>
                  <td>{{ h.priceDate | utc | date:'yyyy/MM/dd' }}@if (h.isLatest) { <small class="latest">آخر سعر</small> } @else if (h.isLatestForSupplier) { <small>آخر سعر لهذا المورد</small> }</td>
                  <td>{{ h.sourceDocument }}</td>
                  <td><span class="pill">{{ h.statusAr }}</span></td>
                </tr>
              }
            </tbody>
          </table></div>
        </section>
      } @else if (loading()) {
        <app-empty-state>جارٍ التحميل…</app-empty-state>
      }
    </div>

    @if (dialog(); as d) {
      @switch (d) {
        @case ('correct') { <app-reference-price-form-dialog [price]="price()" [busy]="saving()" [error]="formError()" (submitted)="correct($event)" (closed)="dialog.set(null)" /> }

        @case ('approve') {
          <app-modal heading="اعتماد سعر للاستخدام الحالي" [subheading]="price()!.number" size="md" [busy]="saving()" (closed)="dialog.set(null)">
            <div class="modal-body form-stack">
              <app-alert [message]="formError()" />
              <p class="muted"><strong>{{ price()!.itemName }}</strong> — {{ price()!.unitPrice | number:'1.0-4' }} {{ price()!.currency }} / {{ price()!.unit }} عند {{ price()!.supplierName }}، المصدر: {{ price()!.sourceDocument }}</p>
              <p class="hint">لا يعتمد السعر من أضافه. وإن كان يصحّح سعراً معتمداً صار ذاك «مُستبدَلاً».</p>
              <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span><textarea name="n" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label>
            </div>
            <footer class="modal-actions"><button type="button" class="ghost" (click)="dialog.set(null)" [disabled]="saving()">إلغاء</button><button type="button" (click)="approve()" [disabled]="saving()">اعتماد</button></footer>
          </app-modal>
        }
      }
    }`
})
export class ReferencePricePage {
  private service = inject(PricingService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  readonly router = inject(Router);
  private latest = latestRequest();

  st = REFERENCE_STATUS;
  price = signal<ReferencePrice | null>(null);
  loading = signal(false);
  error = signal('');
  dialog = signal<Dialog | null>(null);
  saving = signal(false);
  formError = signal('');
  note = '';

  constructor() { this.route.paramMap.subscribe(p => this.load(Number(p.get('id')))); }

  load(id = this.price()?.id ?? 0) {
    if (!id) return;
    this.latest(this.service.getReferencePrice(id), this.loading, this.error, p => this.price.set(p));
  }

  goTo(id: number) { void this.router.navigate(['/pricing/reference-prices', id]); }
  open(dialog: Dialog) { this.formError.set(''); this.note = ''; this.dialog.set(dialog); }

  /** بعد التصحيح يُفتح السجل البديل (بانتظار الاعتماد) */
  correct(v: ReferencePriceSubmit) {
    const p = this.price()!;
    trackRequest(this.service.correctReferencePrice(p.id, v as ReferencePriceCorrection), this.saving, this.formError, created => {
      this.dialog.set(null); this.toast.success('أُنشئ سجل التصحيح وينتظر الاعتماد');
      this.goTo(created.id);
    });
  }

  approve() {
    const p = this.price()!;
    trackRequest(this.service.approveReferencePrice(p.id, this.note, p.rowVersion), this.saving, this.formError, updated => {
      this.price.set(updated); this.dialog.set(null); this.toast.success('اعتُمد السعر للاستخدام الحالي');
    });
  }
}
