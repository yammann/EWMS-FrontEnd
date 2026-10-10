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
import { Modal } from '@shared/ui/modal';
import { StatusChip } from '../components/maintenance-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { CrudPage } from '@shared/ui/crud-page';
import { RowActions } from '@shared/ui/row-actions';
import { FormActions } from '@shared/ui/form-actions';

const KINDS = Object.keys(MAINTENANCE_LOOKUPS) as MaintenanceLookupKind[];

/**
 * إعدادات الصيانة: القوائم التي تظهر في نموذج الطلب والبحث —
 * أنواع الأجهزة، الشركات المصنّعة، أنواع الأعطال، وحالات الطلب (بألوانها، وهي أعمدة لوحة الحالات).
 */
@Component({
  selector: 'app-maintenance-settings-page', standalone: true, imports: [FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, Modal, StatusChip, Pager, RowActions],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './settings-page.html',
  styles: [`
    .segmented { justify-self: start; flex-wrap: wrap; }
    .color-row { display: flex; align-items: center; gap: 14px; }
    .color-row input { width: 56px; height: 40px; padding: 4px; cursor: pointer; }
  `]
})
export class MaintenanceSettingsPage {
  private service = inject(MaintenanceService);
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

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    color: ['#3B82F6'],
    stage: [2 as MaintenanceStage]
  });
  private stageValue = toSignal(this.form.controls.stage.valueChanges, { initialValue: this.form.controls.stage.value });
  stageHint = computed(() => MAINTENANCE_STAGES.find(s => s.value === this.stageValue())?.hint ?? '');

  crud = new CrudPage<MaintenanceLookup, Partial<MaintenanceLookup>>({
    // التبويب من الرابط: التحميل يبدأ عند قراءة ?tab=
    immediate: false,
    load: () => this.service.lookup(this.kind()),
    create: body => this.service.createLookup(this.kind(), body),
    update: (id, body) => this.service.updateLookup(this.kind(), id, body),
    remove: item => this.service.deleteLookup(this.kind(), item.id),
    can: { create: () => this.can().createLookup, edit: () => this.can().editLookup, delete: () => this.can().deleteLookup },
    onOpen: item => this.form.reset({ name: item?.name ?? '', description: item?.description ?? '', color: item?.color || '#3B82F6', stage: item?.stage ?? 2 }),
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'القوائم',
      confirmDelete: item => `حذف «${item.name}» من ${this.meta().label}؟`
    }
  });
  pager = new Pagination(() => this.crud.items());

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const tab = p.get('tab') as MaintenanceLookupKind | null;
      this.kind.set(tab && KINDS.includes(tab) ? tab : 'deviceTypes');
      this.crud.reload(true);
    });
  }

  setKind(kind: MaintenanceLookupKind) {
    this.router.navigate([], { queryParams: { tab: kind === 'deviceTypes' ? null : kind }, queryParamsHandling: 'merge' });
  }



  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const meta = this.meta();
    const body: Partial<MaintenanceLookup> = { name: v.name.trim() };
    if (meta.description) body.description = v.description.trim();
    if (meta.color) { body.color = v.color.toUpperCase(); body.stage = v.stage; }
    this.crud.save(body);
  }
}
