import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import {
  MAINTENANCE_LOOKUPS, MAINTENANCE_STAGES, MaintenanceLookup, MaintenanceLookupKind, MaintenanceStage, isFinalStage, stageLabel
} from '../data-access/maintenance.models';
import { money } from '@core/utils/format';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { StatusChip } from '../components/maintenance-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

const KINDS = Object.keys(MAINTENANCE_LOOKUPS) as MaintenanceLookupKind[];

/**
 * إعدادات الصيانة: القوائم التي تظهر في نموذج الطلب والبحث —
 * أنواع الأجهزة، الشركات المصنّعة، أنواع الأعطال، وحالات الطلب (بألوانها، وهي أعمدة لوحة الحالات).
 */
@Component({
  selector: 'app-maintenance-settings-page', standalone: true, imports: [FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, Modal, StatusChip, Pager],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/devices.scss', '../../../shared/styles/maintenance.scss'],
  templateUrl: './settings-page.html',
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
    this.items.set([]);
    trackRequest(this.service.lookup(kind), this.loading, this.error, list => { if (kind === this.kind()) { this.items.set(list); } });
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
    trackRequest((item ? this.service.updateLookup(this.kind(), item.id, body) : this.service.createLookup(this.kind(), body)), this.saving, this.formError, () => { this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); });
  }

  async askDelete(item: MaintenanceLookup) {
    if (!await this.confirm.ask(`حذف «${item.name}» من ${this.meta().label}؟`, 'حذف')) return;
    this.service.deleteLookup(this.kind(), item.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }
}
