import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { DOCUMENT_KINDS } from '@features/projects';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { trackRequest } from '@shared/ui/track-request';
import { DeliverableType, DeliverableTypeInput } from '../data-access/studies.models';
import { StudiesService } from '../data-access/studies.service';

/**
 * أنواع المخرجات الفنية للفرع (معماري، إنشائي، كهربائي، ميكانيكي، كميات…): يعرّفها كل فرع بأسمائه، ونوع الوثيقة يصنّف ملف المخرج في
 * الإضبارة. النوع الذي عليه مخرجات لا يُحذف (يُعطَّل). لنظرة المؤسسة اختيار الفرع.
 */
@Component({
  selector: 'app-deliverable-types-page', standalone: true,
  imports: [FormsModule, PageHeader, Alert, EmptyState, Modal, SelectValue],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  styles: [`
    .off { color: var(--ink-500); }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
  `],
  template: `
    <div class="page">
      <app-page-header eyebrow="الدراسات" heading="أنواع المخرجات الفنية"
                       subtitle="يعرّفها كل فرع بأسمائه؛ ومسار كل مخرج ثابت: إعداد ← مراجعة ← معتمد أو معاد بسبب" />

      @if (access().canChooseBranch) {
        <div class="toolbar">
          <select #b [appSelectValue]="branchId() ?? ''" (change)="pickBranch(b.value ? +b.value : null)" aria-label="الفرع">
            <option value="">اختر الفرع</option>
            @for (br of branches(); track br.id) { <option [value]="br.id">{{ br.name }}</option> }
          </select>
        </div>
      }
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (access().canChooseBranch && !branchId()) { <app-empty-state>اختر الفرع لإدارة أنواع مخرجاته</app-empty-state> }
      @else {
        <section class="panel">
          <div class="panel-heading"><h2>الأنواع <span class="count">({{ types().length }})</span></h2>
            @if (access().canCreateType) { <button class="btn" type="button" (click)="openForm(null)">+ نوع</button> }</div>
          @if (!types().length) { <app-empty-state>لا أنواع بعد — أضف أول نوع (مثل «معماري» أو «إنشائي»)</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>نوع الوثيقة</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (t of types(); track t.id) {
                  <tr [class.off]="!t.isActive">
                    <td class="cell-strong">{{ t.name }}</td>
                    <td>{{ t.documentKindAr }}</td>
                    <td class="num">{{ t.sortOrder }}</td>
                    <td>{{ t.isActive ? 'فعّال' : 'معطّل' }}</td>
                    <td class="actions">
                      @if (access().canEditType) { <button type="button" class="btn btn-ghost btn-sm" (click)="openForm(t)">تعديل</button> }
                      @if (access().canDeleteType) { <button type="button" class="btn btn-ghost btn-sm" (click)="remove(t)">حذف</button> }
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
      <app-modal [heading]="e.id ? 'تعديل نوع مخرج' : 'إضافة نوع مخرج'" size="md" [busy]="saving()" (closed)="editing.set(null)">
        <form (ngSubmit)="save()">
          <div class="modal-body form-stack">
            <app-alert [message]="formError()" />
            <label class="form-field"><span class="form-label">الاسم</span>
              <input name="name" [(ngModel)]="name" maxlength="100" autocomplete="off" required></label>
            <label class="form-field"><span class="form-label">نوع الوثيقة في الإضبارة</span>
              <select name="kind" [(ngModel)]="kind">
                @for (k of kinds; track k.value) { <option [ngValue]="k.value">{{ k.label }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">الترتيب</span>
              <input name="sort" type="number" min="0" max="1000" [(ngModel)]="sortOrder"></label>
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
export class DeliverableTypesPage {
  private service = inject(StudiesService);
  private lookups = inject(LookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  access = this.service.access;
  kinds = DOCUMENT_KINDS;
  branches = signal<Branch[]>([]);
  branchId = signal<number | null>(null);
  types = signal<DeliverableType[]>([]);
  error = signal('');

  editing = signal<{ id: number | null } | null>(null);
  saving = signal(false);
  formError = signal('');
  name = ''; kind = 99; sortOrder = 0; isActive = true;

  constructor() {
    if (this.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
    else this.load();
  }

  pickBranch(id: number | null) { this.branchId.set(id); if (id) this.load(); else this.types.set([]); }

  load() {
    this.error.set('');
    this.service.types(this.branchId(), true).subscribe({ next: t => this.types.set(t), error: e => this.error.set(e.message) });
  }

  openForm(t: DeliverableType | null) {
    this.formError.set('');
    this.name = t?.name ?? ''; this.kind = t?.documentKind ?? 99; this.sortOrder = t?.sortOrder ?? this.types().length + 1; this.isActive = t?.isActive ?? true;
    this.editing.set({ id: t?.id ?? null });
  }

  save() {
    const e = this.editing();
    if (!e || !this.name.trim()) return;
    const body: DeliverableTypeInput = { branchId: this.branchId(), name: this.name.trim(), documentKind: this.kind, isActive: this.isActive, sortOrder: this.sortOrder || 0 };
    const request = e.id ? this.service.updateType(e.id, body) : this.service.createType(body);
    trackRequest(request, this.saving, this.formError, () => { this.editing.set(null); this.toast.success('حُفظ'); this.load(); });
  }

  async remove(t: DeliverableType) {
    if (!(await this.confirm.ask(`حذف النوع «${t.name}»؟ (لا يُحذف نوع عليه مخرجات: عطّله)`, 'حذف'))) return;
    this.service.deleteType(t.id).subscribe({ next: () => { this.toast.success('حُذف النوع'); this.load(); }, error: e => this.error.set(e.message) });
  }
}
