import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { saveBlob } from '@core/utils/download';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { trackRequest } from '@shared/ui/track-request';
import { ReferencePriceImportReport } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';

/**
 * استيراد الأسعار المرجعية من Excel: تنزيل القالب ← رفع الملف ← معاينة بأخطاء الأسطر ← تأكيد الحفظ.
 * الكل أو لا شيء: لا يُفعَّل التأكيد وفي الملف خطأ، والخادم يعيد الفحص عند الحفظ ويرفض الملف كله إن وُجد سطر خاطئ.
 * الأسعار المستوردة «تاريخية» وتنتظر الاعتماد من غير المستورِد.
 */
@Component({
  selector: 'app-reference-price-import-dialog', standalone: true,
  imports: [FormsModule, Alert, Modal],
  styles: [`
    .report { max-height: 340px; overflow: auto; }
    td small { display: block; color: var(--ink-500); }
    td.bad { color: var(--danger, #c0392b); }
    tr.invalid td { background: color-mix(in srgb, var(--danger, #c0392b) 7%, transparent); }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  `],
  template: `
    <app-modal heading="استيراد أسعار مرجعية من Excel" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <div class="modal-body form-stack">
        <app-alert [message]="error()" />
        <p class="muted">نزّل القالب واملأه (المورد باسمه تماماً من سجل الموردين، والسعر بنقطة عشرية، والتاريخ 2026-10-05، ومصدر السعر مطلوب). يُفحص الملف كله أولاً، وإن وُجد سطر خاطئ واحد لا يُحفظ أي سطر.
          الأسعار المستوردة تاريخية وتنتظر الاعتماد من غيرك.</p>
        <div class="summary">
          <button type="button" class="btn btn-ghost btn-sm" (click)="template()" [disabled]="busy()">تنزيل القالب</button>
          <input type="file" accept=".xlsx" (change)="pick($event)" aria-label="ملف Excel">
        </div>
        @if (canChooseBranch()) {
          <label class="form-field"><span class="form-label">الفرع <small class="hint">(اختياري — فرعك إن تُرك)</small></span>
            <select name="b" [(ngModel)]="branchId" (ngModelChange)="reset()"><option [ngValue]="null">فرعي</option>@for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }</select></label>
        }

        @if (report(); as r) {
          <div class="summary">
            <span class="pill" [class.ok]="!r.invalid">{{ r.total }} سطر</span>
            <span class="pill ok">{{ r.valid }} سليم</span>
            @if (r.invalid) { <span class="pill warn">{{ r.invalid }} فيه أخطاء</span> }
          </div>
          <p [class.late]="r.invalid" role="status">{{ r.message }}</p>
          <div class="table-wrap report"><table>
            <thead><tr><th>السطر</th><th>المادة</th><th>المورد</th><th>السعر</th><th>التاريخ</th><th>الأخطاء</th></tr></thead>
            <tbody>
              @for (row of r.rows; track row.row) {
                <tr [class.invalid]="!row.valid">
                  <td>{{ row.row }}</td>
                  <td>{{ row.itemName }}@if (row.itemCode) { <small dir="ltr">{{ row.itemCode }}</small> }</td>
                  <td>{{ row.supplier }}</td>
                  <td>{{ row.unitPrice }} {{ row.currency }} / {{ row.unit }}</td>
                  <td>{{ row.priceDate }}</td>
                  <td class="bad">@for (e of row.errors; track $index) { <div>{{ e }}</div> }</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </div>
      <footer class="modal-actions">
        <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إغلاق</button>
        <button type="button" class="ghost" (click)="preview()" [disabled]="busy() || !file()">معاينة</button>
        <button type="button" (click)="confirm()" [disabled]="busy() || !canConfirm()">تأكيد الاستيراد</button>
      </footer>
    </app-modal>`
})
export class ReferencePriceImportDialog {
  private service = inject(PricingService);
  private lookups = inject(LookupsService);
  private toast = inject(ToastService);

  imported = output<void>();
  closed = output<void>();

  file = signal<File | null>(null);
  report = signal<ReferencePriceImportReport | null>(null);
  busy = signal(false);
  error = signal('');
  branches = signal<Branch[]>([]);
  branchId: number | null = null;
  canChooseBranch = computed(() => this.service.access().canChooseBranch);
  /** التأكيد بعد معاينة سليمة بلا أخطاء فقط */
  canConfirm = computed(() => { const r = this.report(); return !!this.file() && !!r && r.dryRun && !r.saved && r.invalid === 0 && r.valid > 0; });

  constructor() {
    if (this.canChooseBranch()) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  template() {
    this.service.referencePriceTemplate().subscribe({ next: blob => saveBlob(blob, 'قالب-استيراد-الأسعار-المرجعية.xlsx'), error: e => this.error.set(e.message) });
  }

  pick(event: Event) {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.reset();
  }

  /** تغيّر الملف أو الفرع: تُنسى المعاينة السابقة فلا يُؤكَّد غير ما فُحص */
  reset() { this.report.set(null); this.error.set(''); }

  preview() {
    const f = this.file();
    if (!f) return;
    trackRequest(this.service.importReferencePrices(f, true, this.branchId), this.busy, this.error, r => this.report.set(r));
  }

  confirm() {
    const f = this.file();
    if (!f) return;
    trackRequest(this.service.importReferencePrices(f, false, this.branchId), this.busy, this.error, r => {
      this.report.set(r);
      if (r.saved) { this.toast.success(`استُورد ${r.imported} سعراً وهي بانتظار الاعتماد`); this.imported.emit(); this.closed.emit(); }
    });
  }
}
