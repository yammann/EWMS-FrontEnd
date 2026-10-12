import { Component, computed, inject, signal } from '@angular/core';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { Pagination } from '@core/utils/pagination';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { SelectValue } from '@shared/ui/select-value';
import { LayerFormDialog } from '../components/layer-form-dialog';
import { LayerInput, MapLayerDefinition, fieldTypeLabel } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';

/**
 * طبقات خرائط الفروع (1.2.0): كل فرع يعرّف طبقاته وحقولها، وتُسجَّل معلوماته على المواقع المشتركة
 * (من صفحة الموقع) وتظهر نقاطها على خريطته بلون الطبقة. القائمة = طبقات فرعي، أو أي فرع لنظرة المؤسسة.
 */
@Component({
  selector: 'app-map-layers-page', standalone: true,
  imports: [PageHeader, Alert, EmptyState, Pager, RowActions, SelectValue, LayerFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './map-layers-page.scss'],
  templateUrl: './map-layers-page.html'
})
export class MapLayersPage {
  private service = inject(MapLayersService);
  private lookups = inject(LookupsService);
  access = this.service.access;
  typeLabel = fieldTypeLabel;

  branches = signal<Branch[]>([]);
  /** فلتر الفرع (نظرة المؤسسة فقط) — null = كل الفروع */
  branchId = signal<number | null>(null);

  crud = new CrudPage<MapLayerDefinition, LayerInput>({
    load: () => this.service.layers(this.branchId()),
    create: body => this.service.createLayer(body),
    // rowVersion كما وصل: يمنع محو تعديل مستخدم آخر بصمت
    update: (id, body, l) => this.service.updateLayer(id, { ...body, rowVersion: l.rowVersion }),
    remove: l => this.service.deleteLayer(l.id),
    can: { create: () => this.access().canCreateLayer, edit: () => this.access().canEditLayer, delete: () => this.access().canDeleteLayer },
    messages: {
      saved: 'تم حفظ الطبقة', deleted: 'تم حذف الطبقة', plural: 'الطبقات',
      confirmDelete: l => `حذف طبقة «${l.name}»؟ لا تُحذف طبقة عليها سجلات — عطّلها بدلاً من ذلك لإخفائها مع إبقاء سجلاتها.`
    }
  });

  search = signal('');
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.crud.items();
    return q ? all.filter(l => [l.name, l.description, l.branchName, ...l.fields.map(f => f.label)].some(v => (v ?? '').toLowerCase().includes(q))) : all;
  });
  pager = new Pagination(() => this.filtered());

  constructor() {
    if (this.access().canChooseBranch) {
      this.lookups.branchOptions().subscribe({ next: list => this.branches.set(list), error: () => this.branches.set([]) });
    }
  }

  selectBranch(value: string) {
    this.branchId.set(value ? Number(value) : null);
    this.crud.reload(true);
  }

  visibleFields(l: MapLayerDefinition) { return l.fields.filter(f => !f.isHidden); }
  hiddenCount(l: MapLayerDefinition) { return l.fields.filter(f => f.isHidden).length; }

  /** ملخص فلتر طبقة بيانات النظام */
  filterSummary(l: MapLayerDefinition) {
    const n = Object.values(l.sourceFilter ?? {}).reduce((sum, v) => sum + v.length, 0);
    return n ? `مُصفّاة بـ ${n} قيمة` : 'كل بيانات الفرع';
  }

  /** تغيّر حقل من داخل النافذة (حذف/إخفاء/إعادة): تحديث الطبقة المفتوحة وإعادة قراءة القائمة بصمت */
  fieldChanged(layer: MapLayerDefinition) {
    this.crud.dialog.update(d => d && { ...d, item: layer });
    this.crud.reload();
  }
}
