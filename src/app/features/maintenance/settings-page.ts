import { Pagination } from '../../core/utils/pagination';
import { Pager } from '../../shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceService } from '../../core/services/maintenance.service';
import {
  MAINTENANCE_LOOKUPS, MAINTENANCE_STAGES, MaintenanceLookup, MaintenanceLookupKind, MaintenanceStage, isFinalStage, stageLabel
} from '../../core/models/maintenance.models';
import { money } from '../../core/models/spare-part.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { StatusChip } from './maintenance-ui';

const KINDS = Object.keys(MAINTENANCE_LOOKUPS) as MaintenanceLookupKind[];

/**
 * إعدادات الصيانة: القوائم التي تظهر في نموذج الطلب والبحث —
 * أنواع الأجهزة، الشركات المصنّعة، أنواع الأعطال، وحالات الطلب (بألوانها، وهي أعمدة لوحة الحالات).
 */
@Component({
  selector: 'app-maintenance-settings-page', standalone: true, imports: [ReactiveFormsModule, Modal, StatusChip, Pager],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الصيانة</span><h1>إعدادات الصيانة</h1><p class="muted">القوائم المستخدمة في طلبات الصيانة</p></div>
        <div class="header-actions">
          @if (can().createLookup) { <button class="btn" type="button" (click)="openForm(null)">+ {{ meta().single }}</button> }
        </div>
      </header>

      <nav class="segmented" role="tablist" aria-label="القائمة">
        @for (k of kinds; track k) {
          <button type="button" role="tab" [class.on]="kind() === k" [attr.aria-selected]="kind() === k" (click)="setKind(k)">{{ lookups[k].label }}</button>
        }
      </nav>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <section class="panel">
        <div class="panel-heading"><div><h2>{{ meta().label }} <span class="count">({{ items().length }})</span></h2>
          @if (meta().color) { <p>كل حالة تظهر عموداً في «لوحة الحالات» بلونها وبترتيب مراحلها. المرحلة تحدد السلوك: «قيد العمل» تسجّل وقت البدء، «جاهز للتسليم» وقت الإنجاز وتبلّغ العميل، و«مُسلَّم» / «غير قابل للصيانة» نهائيتان تُقفلان الطلب (ويُثبَّت في «مُسلَّم» توقيع ورقة التسليم).</p> }</div></div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!items().length) { <p class="empty-state">لا توجد عناصر بعد</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الاسم</th>@if (meta().description) { <th>الوصف</th> }@if (meta().color) { <th>اللون</th><th>المرحلة</th> }<th class="actions-th"></th></tr></thead>
            <tbody>
              @for (item of pager.items(); track item.id) {
                <tr>
                  <td>@if (meta().color) { <app-status-chip [name]="item.name" [color]="item.color" /> } @else { <span class="cell-strong">{{ item.name }}</span> }</td>
                  @if (meta().description) { <td class="wrap">{{ item.description || '—' }}</td> }
                  @if (meta().color) { <td><span class="mono">{{ item.color }}</span></td><td>{{ stageLabel(item.stage) }}@if (isFinal(item.stage)) { <span class="muted"> · نهائية</span> }</td> }
                  <td><div class="row-actions">
                    @if (can().editLookup) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(item)">تعديل</button> }
                    @if (can().deleteLookup) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(item)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-modal [heading]="(editing() ? 'تعديل ' : 'إضافة ') + meta().single" [busy]="saving()" (closed)="closeForm()">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body form-stack">
            @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
            <label class="form-field"><span class="form-label">الاسم</span><input formControlName="name" maxlength="100"></label>
            @if (meta().description) {
              <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="500"></textarea></label>
            }
            @if (meta().color) {
              <label class="form-field"><span class="form-label">اللون</span>
                <span class="color-row"><input type="color" formControlName="color"><app-status-chip [name]="form.controls.name.value || 'معاينة'" [color]="form.controls.color.value" /></span></label>
              <label class="form-field"><span class="form-label">المرحلة</span>
                <select formControlName="stage">
                  @for (s of stages; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }
                </select>
                <small class="hint">{{ stageHint() }}</small></label>
            }
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
          </footer>
        </form>
      </app-modal>
    }`,
  styles: [`
    .segmented { justify-self: start; flex-wrap: wrap; }
    .color-row { display: flex; align-items: center; gap: 14px; }
    .color-row input { width: 56px; height: 40px; padding: 4px; cursor: pointer; }
  `]
})
export class MaintenanceSettingsPage {
  pager = new Pagination(() => this.items());
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  can = this.service.can;
  kinds = KINDS;
  stages = MAINTENANCE_STAGES;
  money = money;
  stageLabel = stageLabel;
  isFinal = isFinalStage;
  lookups = MAINTENANCE_LOOKUPS;

  kind = signal<MaintenanceLookupKind>('deviceTypes');
  meta = computed(() => MAINTENANCE_LOOKUPS[this.kind()]);
  items = signal<MaintenanceLookup[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formError = signal('');
  formOpen = signal(false);
  editing = signal<MaintenanceLookup | null>(null);

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    color: ['#3B82F6'],
    stage: [2 as MaintenanceStage]
  });
  private stageValue = toSignal(this.form.controls.stage.valueChanges, { initialValue: this.form.controls.stage.value });
  stageHint = computed(() => MAINTENANCE_STAGES.find(s => s.value === this.stageValue())?.hint ?? '');

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const tab = p.get('tab') as MaintenanceLookupKind | null;
      this.kind.set(tab && KINDS.includes(tab) ? tab : 'deviceTypes');
      this.load();
    });
  }

  setKind(kind: MaintenanceLookupKind) {
    this.router.navigate([], { queryParams: { tab: kind === 'deviceTypes' ? null : kind }, queryParamsHandling: 'merge' });
  }

  load() {
    const kind = this.kind();
    this.loading.set(true); this.error.set(''); this.items.set([]);
    this.service.lookup(kind).subscribe({
      next: list => { if (kind === this.kind()) { this.items.set(list); this.loading.set(false); } },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(item: MaintenanceLookup | null) {
    this.editing.set(item); this.formError.set('');
    this.form.reset({ name: item?.name ?? '', description: item?.description ?? '', color: item?.color || '#3B82F6', stage: item?.stage ?? 2 });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const meta = this.meta();
    const body: Partial<MaintenanceLookup> = { name: v.name.trim() };
    if (meta.description) body.description = v.description.trim();
    if (meta.color) { body.color = v.color.toUpperCase(); body.stage = v.stage; }

    const item = this.editing();
    this.saving.set(true); this.formError.set('');
    (item ? this.service.updateLookup(this.kind(), item.id, body) : this.service.createLookup(this.kind(), body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

  async askDelete(item: MaintenanceLookup) {
    if (!await this.confirm.ask(`حذف «${item.name}» من ${this.meta().label}؟`, 'حذف')) return;
    this.service.deleteLookup(this.kind(), item.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }
}
