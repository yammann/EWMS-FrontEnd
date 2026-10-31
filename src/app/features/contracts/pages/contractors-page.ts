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
import { Contractor, ContractorInput } from '../data-access/contracts.models';
import { ContractsService } from '../data-access/contracts.service';

/**
 * المقاولون (سجل الفرع): بيانات يديرها مكتب العقود، يُختارون للتعاقد وتُسجَّل عليهم العروض والتقييمات. المقاول المرتبط بعقد أو عرض أو تقييم
 * لا يُحذف (يُعطَّل). لنظرة المؤسسة اختيار الفرع.
 */
@Component({
  selector: 'app-contractors-page', standalone: true,
  imports: [FormsModule, PageHeader, Alert, EmptyState, Modal, SelectValue],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  styles: [`.off { color: var(--ink-500); } .actions { display: flex; gap: 6px; justify-content: flex-end; }`],
  template: `
    <div class="page">
      <app-page-header eyebrow="العقود" heading="المقاولون" subtitle="سجل مقاولي الفرع ومتعهديه: يُختارون للتعاقد وتُسجَّل عليهم العروض وتقييمات مهندسي المواقع" />

      @if (access().canChooseBranch) {
        <div class="toolbar">
          <select #b [appSelectValue]="branchId() ?? ''" (change)="pickBranch(b.value ? +b.value : null)" aria-label="الفرع">
            <option value="">اختر الفرع</option>
            @for (br of branches(); track br.id) { <option [value]="br.id">{{ br.name }}</option> }
          </select>
        </div>
      }
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (access().canChooseBranch && !branchId()) { <app-empty-state>اختر الفرع لإدارة مقاوليه</app-empty-state> }
      @else {
        <section class="panel">
          <div class="panel-heading"><h2>المقاولون <span class="count">({{ items().length }})</span></h2>
            @if (access().canCreateContractor) { <button class="btn" type="button" (click)="openForm(null)">+ مقاول</button> }</div>
          @if (!items().length) { <app-empty-state>لا مقاولين بعد{{ access().canCreateContractor ? ' — أضف أول مقاول' : '' }}</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>رقم السجل</th><th>المسؤول</th><th>الهاتف</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (c of items(); track c.id) {
                  <tr [class.off]="!c.isActive">
                    <td class="cell-strong">{{ c.name }}</td>
                    <td dir="ltr">{{ c.registrationNumber || '—' }}</td>
                    <td>{{ c.contactName || '—' }}</td>
                    <td dir="ltr">{{ c.phone || '—' }}</td>
                    <td>{{ c.isActive ? 'فعّال' : 'معطّل' }}</td>
                    <td class="actions">
                      @if (access().canEditContractor) { <button type="button" class="btn btn-ghost btn-sm" (click)="openForm(c)">تعديل</button> }
                      @if (access().canDeleteContractor) { <button type="button" class="btn btn-ghost btn-sm" (click)="remove(c)">حذف</button> }
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
      <app-modal [heading]="e.id ? 'تعديل مقاول' : 'إضافة مقاول'" size="md" [busy]="saving()" (closed)="editing.set(null)">
        <form (ngSubmit)="save()">
          <div class="modal-body form-stack">
            <app-alert [message]="formError()" />
            <label class="form-field"><span class="form-label">الاسم</span>
              <input name="name" [(ngModel)]="name" maxlength="200" autocomplete="off" required></label>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">رقم السجل أو الترخيص <small class="hint">(اختياري)</small></span>
                <input name="reg" [(ngModel)]="registrationNumber" maxlength="100" dir="ltr" autocomplete="off"></label>
              <label class="form-field"><span class="form-label">المسؤول <small class="hint">(اختياري)</small></span>
                <input name="contact" [(ngModel)]="contactName" maxlength="150" autocomplete="off"></label>
            </div>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">الهاتف <small class="hint">(اختياري)</small></span>
                <input name="phone" [(ngModel)]="phone" maxlength="50" dir="ltr" autocomplete="off"></label>
              <label class="form-field"><span class="form-label">العنوان <small class="hint">(اختياري)</small></span>
                <input name="address" [(ngModel)]="address" maxlength="300" autocomplete="off"></label>
            </div>
            <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span>
              <textarea name="notes" [(ngModel)]="notes" rows="2" maxlength="2000"></textarea></label>
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
export class ContractorsPage {
  private service = inject(ContractsService);
  private lookups = inject(LookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  access = this.service.access;
  branches = signal<Branch[]>([]);
  branchId = signal<number | null>(null);
  items = signal<Contractor[]>([]);
  error = signal('');

  editing = signal<Contractor | { id: null } | null>(null);
  saving = signal(false);
  formError = signal('');
  name = ''; registrationNumber = ''; contactName = ''; phone = ''; address = ''; notes = ''; isActive = true;

  constructor() {
    if (this.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
    else this.load();
  }

  pickBranch(id: number | null) { this.branchId.set(id); if (id) this.load(); else this.items.set([]); }

  load() {
    this.error.set('');
    this.service.contractors(this.branchId(), true).subscribe({ next: c => this.items.set(c), error: e => this.error.set(e.message) });
  }

  openForm(c: Contractor | null) {
    this.formError.set('');
    this.name = c?.name ?? ''; this.registrationNumber = c?.registrationNumber ?? ''; this.contactName = c?.contactName ?? '';
    this.phone = c?.phone ?? ''; this.address = c?.address ?? ''; this.notes = c?.notes ?? ''; this.isActive = c?.isActive ?? true;
    this.editing.set(c ?? { id: null });
  }

  save() {
    const e = this.editing();
    if (!e || !this.name.trim()) return;
    const body: ContractorInput = {
      branchId: this.branchId(), name: this.name.trim(), registrationNumber: this.registrationNumber.trim() || null, contactName: this.contactName.trim() || null,
      phone: this.phone.trim() || null, address: this.address.trim() || null, notes: this.notes.trim() || null, isActive: this.isActive,
      rowVersion: 'rowVersion' in e ? e.rowVersion : null
    };
    const request = e.id ? this.service.updateContractor(e.id, body) : this.service.createContractor(body);
    trackRequest(request, this.saving, this.formError, () => { this.editing.set(null); this.toast.success('حُفظ'); this.load(); });
  }

  async remove(c: Contractor) {
    if (!(await this.confirm.ask(`حذف المقاول «${c.name}»؟ (لا يُحذف مقاول عليه عقود أو عروض أو تقييمات: عطّله)`, 'حذف'))) return;
    this.service.deleteContractor(c.id).subscribe({ next: () => { this.toast.success('حُذف المقاول'); this.load(); }, error: e => this.error.set(e.message) });
  }
}
