import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { trackRequest } from '@shared/ui/track-request';
import { EvaluationCriterion, EvaluationCriterionInput } from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';

/**
 * معايير تقييم المقاولين (إعدادات الفرع): يعرّفها الفرع بأسمائه ووزن اختياري؛ مهندس الموقع يدخل الدرجات يدوياً (0–100) ولا يُحتسب مجموع ولا تصنيف
 * (المعايير وطريقة الدرجة لم تُعتمد رسمياً). المعيار الذي عليه درجات لا يُحذف (يُعطَّل).
 */
@Component({
  selector: 'app-criteria-page', standalone: true,
  imports: [FormsModule, PageHeader, Alert, EmptyState, Modal, SelectValue],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  styles: [`.off { color: var(--ink-500); } .actions { display: flex; gap: 6px; justify-content: flex-end; }`],
  template: `
    <div class="page">
      <app-page-header eyebrow="العقود" heading="معايير تقييم المقاولين" subtitle="يعرّفها الفرع بأسمائه؛ الدرجات يدوية بلا مجموع ولا تصنيف تلقائي" />

      @if (access().canChooseBranch) {
        <div class="toolbar">
          <select #b [appSelectValue]="branchId() ?? ''" (change)="pickBranch(b.value ? +b.value : null)" aria-label="الفرع">
            <option value="">اختر الفرع</option>
            @for (br of branches(); track br.id) { <option [value]="br.id">{{ br.name }}</option> }
          </select>
        </div>
      }
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (access().canChooseBranch && !branchId()) { <app-empty-state>اختر الفرع لإدارة معاييره</app-empty-state> }
      @else {
        <section class="panel">
          <div class="panel-heading"><h2>المعايير <span class="count">({{ items().length }})</span></h2>
            @if (access().canCreateCriterion) { <button class="btn" type="button" (click)="openForm(null)">+ معيار</button> }</div>
          @if (!items().length) { <app-empty-state>لا معايير بعد{{ access().canCreateCriterion ? ' — أضف أول معيار (مثل «جودة التنفيذ» أو «الالتزام بالمواعيد»)' : '' }}</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>المعيار</th><th>الوصف</th><th>الوزن</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (c of items(); track c.id) {
                  <tr [class.off]="!c.isActive">
                    <td class="cell-strong">{{ c.name }}</td>
                    <td>{{ c.description || '—' }}</td>
                    <td class="num">{{ c.weight ?? '—' }}</td>
                    <td class="num">{{ c.sortOrder }}</td>
                    <td>{{ c.isActive ? 'فعّال' : 'معطّل' }}</td>
                    <td class="actions">
                      @if (access().canEditCriterion) { <button type="button" class="btn btn-ghost btn-sm" (click)="openForm(c)">تعديل</button> }
                      @if (access().canDeleteCriterion) { <button type="button" class="btn btn-ghost btn-sm" (click)="remove(c)">حذف</button> }
                    </td>
                  </tr>
                }
              </tbody>
            </table></div>
          }
        </section>
      }
    </div>

    @if (editing(); as e) {
      <app-modal [heading]="e.id ? 'تعديل معيار' : 'إضافة معيار'" size="md" [busy]="saving()" (closed)="editing.set(null)">
        <form (ngSubmit)="save()">
          <div class="modal-body form-stack">
            <app-alert [message]="formError()" />
            <label class="form-field"><span class="form-label">الاسم</span>
              <input name="name" [(ngModel)]="name" maxlength="150" autocomplete="off" required></label>
            <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span>
              <input name="desc" [(ngModel)]="description" maxlength="500" autocomplete="off"></label>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">الوزن <small class="hint">(اختياري، 0–100)</small></span>
                <input name="weight" type="number" min="0" max="100" step="0.01" [(ngModel)]="weight"></label>
              <label class="form-field"><span class="form-label">الترتيب</span>
                <input name="sort" type="number" min="0" max="1000" [(ngModel)]="sortOrder"></label>
            </div>
            <label class="check"><input name="active" type="checkbox" [(ngModel)]="isActive"> فعّال</label>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="editing.set(null)" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="saving() || !name.trim()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
          </footer>
        </form>
      </app-modal>
    }`
})
export class CriteriaPage {
  private service = inject(ContractsService);
  private lookups = inject(LookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  access = this.service.access;
  branches = signal<Branch[]>([]);
  branchId = signal<number | null>(null);
  items = signal<EvaluationCriterion[]>([]);
  error = signal('');

  editing = signal<EvaluationCriterion | { id: null } | null>(null);
  saving = signal(false);
  formError = signal('');
  name = ''; description = ''; weight: number | null = null; sortOrder = 0; isActive = true;

  constructor() {
    if (this.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
    else this.load();
  }

  pickBranch(id: number | null) { this.branchId.set(id); if (id) this.load(); else this.items.set([]); }

  load() {
    this.error.set('');
    this.service.criteria(this.branchId(), true).subscribe({ next: c => this.items.set(c), error: e => this.error.set(e.message) });
  }

  openForm(c: EvaluationCriterion | null) {
    this.formError.set('');
    this.name = c?.name ?? ''; this.description = c?.description ?? ''; this.weight = c?.weight ?? null;
    this.sortOrder = c?.sortOrder ?? this.items().length + 1; this.isActive = c?.isActive ?? true;
    this.editing.set(c ?? { id: null });
  }

  save() {
    const e = this.editing();
    if (!e || !this.name.trim()) return;
    const body: EvaluationCriterionInput = {
      branchId: this.branchId(), name: this.name.trim(), description: this.description.trim() || null, weight: this.weight || null,
      sortOrder: this.sortOrder || 0, isActive: this.isActive, rowVersion: 'rowVersion' in e ? e.rowVersion : null
    };
    const request = e.id ? this.service.updateCriterion(e.id, body) : this.service.createCriterion(body);
    trackRequest(request, this.saving, this.formError, () => { this.editing.set(null); this.toast.success('حُفظ'); this.load(); });
  }

  async remove(c: EvaluationCriterion) {
    if (!(await this.confirm.ask(`حذف المعيار «${c.name}»؟ (لا يُحذف معيار عليه درجات: عطّله)`, 'حذف'))) return;
    this.service.deleteCriterion(c.id).subscribe({ next: () => { this.toast.success('حُذف المعيار'); this.load(); }, error: e => this.error.set(e.message) });
  }
}
