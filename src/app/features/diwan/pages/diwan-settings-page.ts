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
import { CorrespondenceStatus, CorrespondenceStatusInput, CorrespondenceType, CorrespondenceTypeInput, STAGES } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

type Editing = { kind: 'type'; id: number | null } | { kind: 'status'; id: number | null } | null;

/**
 * إعدادات ديوان الفرع: أنواع المعاملات (بمهلة معالجة اختيارية بالأيام) وحالاتها (الاسم واللون من الفرع، والمرحلة ثابتة تحدد السلوك).
 * لا يُحذف نوع أو حالة عليهما معاملات (يُعطَّلان)، ولا تتغير مرحلة حالة مستعملة. لنظرة المؤسسة اختيار الفرع.
 */
@Component({
  selector: 'app-diwan-settings-page', standalone: true,
  imports: [FormsModule, PageHeader, Alert, EmptyState, Modal, SelectValue],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  styles: [`
    .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-inline-end: 6px; vertical-align: middle; }
    .off { color: var(--ink-500); }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
    input[type=color] { width: 56px; height: 36px; padding: 2px; }
  `],
  template: `
    <div class="page">
      <app-page-header eyebrow="الديوان" heading="إعدادات الديوان"
                       subtitle="أنواع المعاملات ومهلها وحالاتها — يضعها كل فرع لنفسه، والمرحلة الثابتة للحالة هي التي تحدد سلوكها" />

      @if (access().canChooseBranch) {
        <div class="toolbar">
          <select #b [appSelectValue]="branchId() ?? ''" (change)="pickBranch(b.value ? +b.value : null)" aria-label="الفرع">
            <option value="">اختر الفرع</option>
            @for (br of branches(); track br.id) { <option [value]="br.id">{{ br.name }}</option> }
          </select>
        </div>
      }
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      @if (access().canChooseBranch && !branchId()) { <app-empty-state>اختر الفرع لإدارة أنواع معاملاته وحالاتها</app-empty-state> }
      @else {
        <section class="panel">
          <div class="panel-heading"><h2>أنواع المعاملات <span class="count">({{ types().length }})</span></h2>
            @if (access().canCreateLookup) { <button class="btn" type="button" (click)="openType(null)">+ نوع</button> }</div>
          @if (!types().length) { <app-empty-state>لا أنواع بعد — أضف أول نوع (مثل «أمر دراسة»)</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>المهلة</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (t of types(); track t.id) {
                  <tr [class.off]="!t.isActive">
                    <td class="cell-strong">{{ t.name }}</td>
                    <td>{{ t.deadlineDays ? t.deadlineDays + ' يوماً' : 'بلا مهلة' }}</td>
                    <td>{{ t.isActive ? 'فعّال' : 'معطّل' }}</td>
                    <td class="actions">
                      @if (access().canEditLookup) { <button type="button" class="btn btn-ghost btn-sm" (click)="openType(t)">تعديل</button> }
                      @if (access().canDeleteLookup) { <button type="button" class="btn btn-ghost btn-sm" (click)="removeType(t)">حذف</button> }
                    </td>
                  </tr>
                }
              </tbody>
            </table></div>
          }
        </section>

        <section class="panel">
          <div class="panel-heading"><h2>حالات المعاملات <span class="count">({{ statuses().length }})</span></h2>
            @if (access().canCreateLookup) { <button class="btn" type="button" (click)="openStatus(null)">+ حالة</button> }</div>
          @if (!statuses().length) { <app-empty-state>لا حالات بعد — أضف حالة بمرحلة «مسجّلة» على الأقل كي يُسجَّل الوارد</app-empty-state> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>المرحلة</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (s of statuses(); track s.id) {
                  <tr [class.off]="!s.isActive">
                    <td class="cell-strong"><span class="swatch" [style.background]="s.color"></span>{{ s.name }}</td>
                    <td>{{ s.stageAr }}</td>
                    <td class="num">{{ s.sortOrder }}</td>
                    <td>{{ s.isActive ? 'فعّالة' : 'معطّلة' }}</td>
                    <td class="actions">
                      @if (access().canEditLookup) { <button type="button" class="btn btn-ghost btn-sm" (click)="openStatus(s)">تعديل</button> }
                      @if (access().canDeleteLookup) { <button type="button" class="btn btn-ghost btn-sm" (click)="removeStatus(s)">حذف</button> }
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
      <app-modal [heading]="(e.id ? 'تعديل ' : 'إضافة ') + (e.kind === 'type' ? 'نوع معاملة' : 'حالة معاملة')" size="md" [busy]="saving()" (closed)="editing.set(null)">
        <form (ngSubmit)="save()">
          <div class="modal-body form-stack">
            <app-alert [message]="formError()" />
            <label class="form-field"><span class="form-label">الاسم</span>
              <input name="name" [(ngModel)]="name" maxlength="100" autocomplete="off" required></label>
            @if (e.kind === 'type') {
              <label class="form-field"><span class="form-label">مهلة المعالجة بالأيام <small class="hint">(فارغ = بلا مهلة ولا تنبيه تأخر)</small></span>
                <input name="days" type="number" min="1" max="3650" [(ngModel)]="deadlineDays"></label>
            } @else {
              <label class="form-field"><span class="form-label">المرحلة <small class="hint">(تحدد السلوك)</small></span>
                <select name="stage" [(ngModel)]="stage">
                  @for (s of stages; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }
                </select>
                <small class="hint">لا تتغير مرحلة حالة عليها معاملات: تُضاف حالة جديدة بدلها.</small>
              </label>
              <label class="form-field"><span class="form-label">اللون</span>
                <input name="color" type="color" [(ngModel)]="color"></label>
            }
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
    }
  `
})
export class DiwanSettingsPage {
  private service = inject(DiwanService);
  private lookups = inject(LookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  access = this.service.access;
  stages = STAGES;
  branches = signal<Branch[]>([]);
  branchId = signal<number | null>(null);
  types = signal<CorrespondenceType[]>([]);
  statuses = signal<CorrespondenceStatus[]>([]);
  error = signal('');

  editing = signal<Editing>(null);
  saving = signal(false);
  formError = signal('');
  name = ''; deadlineDays: number | null = null; stage = 1; color = '#8e8e93'; sortOrder = 0; isActive = true;

  constructor() {
    if (this.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: e => this.error.set(e.message) });
    else this.load();
  }

  pickBranch(id: number | null) { this.branchId.set(id); if (id) this.load(); else { this.types.set([]); this.statuses.set([]); } }

  load() {
    const branch = this.branchId();
    this.error.set('');
    this.service.types(branch, true).subscribe({ next: t => this.types.set(t), error: e => this.error.set(e.message) });
    this.service.statuses(branch, true).subscribe({ next: s => this.statuses.set(s), error: e => this.error.set(e.message) });
  }

  private reset(id: number | null, kind: 'type' | 'status', values: { name: string; sortOrder: number; isActive: boolean }) {
    this.formError.set('');
    this.name = values.name; this.sortOrder = values.sortOrder; this.isActive = values.isActive;
    this.editing.set({ kind, id });
  }

  openType(t: CorrespondenceType | null) {
    this.deadlineDays = t?.deadlineDays ?? null;
    this.reset(t?.id ?? null, 'type', { name: t?.name ?? '', sortOrder: t?.sortOrder ?? this.types().length + 1, isActive: t?.isActive ?? true });
  }

  openStatus(s: CorrespondenceStatus | null) {
    this.stage = s?.stage ?? 1; this.color = (s?.color ?? '#8e8e93').toLowerCase();
    this.reset(s?.id ?? null, 'status', { name: s?.name ?? '', sortOrder: s?.sortOrder ?? this.statuses().length + 1, isActive: s?.isActive ?? true });
  }

  save() {
    const e = this.editing();
    if (!e || !this.name.trim()) return;
    const branchId = this.branchId();
    if (e.kind === 'type') {
      const body: CorrespondenceTypeInput = { branchId, name: this.name.trim(), deadlineDays: this.deadlineDays || null, isActive: this.isActive, sortOrder: this.sortOrder || 0 };
      const request = e.id ? this.service.updateType(e.id, body) : this.service.createType(body);
      trackRequest(request, this.saving, this.formError, () => this.saved());
    } else {
      const body: CorrespondenceStatusInput = { branchId, name: this.name.trim(), stage: this.stage, color: this.color.toUpperCase(), isActive: this.isActive, sortOrder: this.sortOrder || 0 };
      const request = e.id ? this.service.updateStatus(e.id, body) : this.service.createStatus(body);
      trackRequest(request, this.saving, this.formError, () => this.saved());
    }
  }

  private saved() { this.editing.set(null); this.toast.success('حُفظ'); this.load(); }

  async removeType(t: CorrespondenceType) {
    if (!(await this.confirm.ask(`حذف النوع «${t.name}»؟ (لا يُحذف نوع عليه معاملات: عطّله)`, 'حذف'))) return;
    this.service.deleteType(t.id).subscribe({ next: () => { this.toast.success('حُذف النوع'); this.load(); }, error: e => this.error.set(e.message) });
  }

  async removeStatus(s: CorrespondenceStatus) {
    if (!(await this.confirm.ask(`حذف الحالة «${s.name}»؟ (لا تُحذف حالة عليها معاملات: عطّلها)`, 'حذف'))) return;
    this.service.deleteStatus(s.id).subscribe({ next: () => { this.toast.success('حُذفت الحالة'); this.load(); }, error: e => this.error.set(e.message) });
  }
}
