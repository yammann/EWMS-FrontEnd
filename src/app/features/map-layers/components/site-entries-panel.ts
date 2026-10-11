import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Department } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { errorMessage } from '@shared/ui/error-message';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { MapEntry, MapLayerDefinition, SiteEntries, formatFieldValue } from '../data-access/map-layers.models';
import { MapLayersService } from '../data-access/map-layers.service';
import { EntryFormDialog } from './entry-form-dialog';

/**
 * «معلومات الفروع» في صفحة الموقع: سجلات الطبقات التي أراها على هذا الموقع (قسمي، أو فرعي كله مع ViewBranchMapEntries،
 * أو الكل لنظرة المؤسسة) مجمّعة حسب الطبقة، مع الإضافة والتعديل والحذف حسب الصلاحيات.
 */
@Component({
  selector: 'app-site-entries-panel', standalone: true,
  imports: [EntryFormDialog, EmptyState, Alert, RouterLink],
  templateUrl: './site-entries-panel.html',
  styleUrl: './site-entries-panel.scss'
})
export class SiteEntriesPanel {
  private service = inject(MapLayersService);
  private lookups = inject(LookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  siteId = input.required<number>();
  siteName = input('');

  access = this.service.access;
  data = signal<SiteEntries | null>(null);
  loading = signal(false);
  error = signal('');
  departments = signal<Department[]>([]);
  /** نافذة الإضافة (entry = null) أو التعديل */
  dialog = signal<{ entry: MapEntry | null } | null>(null);
  deletingId = signal<number | null>(null);
  format = formatFieldValue;

  /** السجلات مجمّعة حسب الطبقة بترتيب الطبقات */
  groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    return d.layers
      .map(layer => ({ layer, entries: d.entries.filter(e => e.layerId === layer.id) }))
      .filter(g => g.entries.length);
  });

  /** أكثر من فرع (نظرة المؤسسة): يظهر اسم الفرع بجانب الطبقة */
  multiBranch = computed(() => new Set((this.data()?.layers ?? []).map(l => l.branchId)).size > 1);

  /** طبقات تقبل سجلاً جديداً هنا: فعّالة، والأحادية بلا سجل ظاهر بعد (الخادم يتحقق من الباقي) */
  creatable = computed(() => {
    const d = this.data();
    if (!d?.canCreate) return [];
    return d.layers.filter(l => l.isActive && (l.allowMultiple || !d.entries.some(e => e.layerId === l.id)));
  });

  dialogLayers = computed<MapLayerDefinition[]>(() => {
    const dlg = this.dialog(); const d = this.data();
    if (!dlg || !d) return [];
    return dlg.entry ? d.layers.filter(l => l.id === dlg.entry!.layerId) : this.creatable();
  });

  constructor() {
    effect(() => { const id = this.siteId(); untracked(() => this.load(id)); });
    const a = this.access();
    if (a.canChooseUnit && a.canListDepartments && (a.canCreate || a.canEdit)) {
      this.lookups.departments().subscribe({ next: list => this.departments.set(list), error: () => this.departments.set([]) });
    }
  }

  load(id = this.siteId()) {
    this.latest(this.service.siteEntries(id), this.loading, this.error, d => this.data.set(d));
  }

  saved(entry: MapEntry, isEdit: boolean) {
    this.dialog.set(null);
    this.toast.success(isEdit ? 'تم حفظ السجل' : `أُضيف السجل إلى طبقة «${entry.layerName}»`);
    this.load();
  }

  async remove(entry: MapEntry) {
    if (this.deletingId() !== null) return;
    if (!await this.confirm.ask(`حذف هذا السجل من طبقة «${entry.layerName}»؟`, 'حذف')) return;
    this.deletingId.set(entry.id);
    this.service.deleteEntry(entry.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.data.update(d => d && { ...d, entries: d.entries.filter(e => e.id !== entry.id) });
        this.toast.success('تم حذف السجل');
      },
      error: e => { this.deletingId.set(null); this.toast.error(errorMessage(e, 'تعذر الحذف')); }
    });
  }
}
