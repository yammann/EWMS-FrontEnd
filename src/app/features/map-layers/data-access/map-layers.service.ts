import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName } from '@core/constants/access';
import { EntryInput, LayerInput, MapEntry, MapLayerDefinition, SiteEntries } from './map-layers.models';

/** طبقات خرائط الفروع وسجلاتها (api/MapLayers و api/MapEntries) */
@Injectable({ providedIn: 'root' })
export class MapLayersService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** صلاحياتي — الحدود (فرعي/قسمي) يطبّقها الخادم */
  access = computed(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    const entries = {
      canCreate: has(AppPermission.CreateMapEntry),
      canEdit: has(AppPermission.EditMapEntry),
      canDelete: has(AppPermission.DeleteMapEntry)
    };
    const canViewEntries = has(AppPermission.ViewDepartmentMapEntries) || has(AppPermission.ViewBranchMapEntries)
      || entries.canCreate || entries.canEdit || entries.canDelete;
    return {
      canCreateLayer: has(AppPermission.CreateMapLayer),
      canEditLayer: has(AppPermission.EditMapLayer),
      canDeleteLayer: has(AppPermission.DeleteMapLayer),
      canViewEntries,
      ...entries,
      /** يختار القسم المالك للسجل: نظرة المؤسسة أو سجلات الفرع كله */
      canChooseUnit: has(AppPermission.ViewOrganizationDashboard) || has(AppPermission.ViewBranchMapEntries),
      /** يختار فرع الطبقة (نظرة المؤسسة) */
      canChooseBranch: has(AppPermission.ViewOrganizationDashboard),
      /** قائمة الأقسام لاختيار القسم المالك (Department/GetAll) */
      canListDepartments: has(AppPermission.ViewDepartments)
    };
  });

  // ─────────── الطبقات ───────────
  layers(branchId: number | null) {
    return this.api.get<MapLayerDefinition[]>('/MapLayers/GetAll' + (branchId ? `?branchId=${branchId}` : ''));
  }
  createLayer(v: LayerInput) { return this.api.post<MapLayerDefinition>('/MapLayers/Create', v); }
  updateLayer(id: number, v: LayerInput) { return this.api.put<MapLayerDefinition>(`/MapLayers/Update/${id}`, v); }
  deleteLayer(id: number) { return this.api.delete<{ message: string }>(`/MapLayers/Delete/${id}`); }
  fieldUsage(fieldId: number) { return this.api.get<{ count: number }>(`/MapLayers/FieldUsage/${fieldId}`); }
  /** بلا قيم يُحذف؛ له قيم: purge=false يخفيه، purge=true يحذفه مع قيمه */
  deleteField(fieldId: number, purge: boolean) { return this.api.delete<MapLayerDefinition>(`/MapLayers/Field/${fieldId}?purge=${purge}`); }
  restoreField(fieldId: number) { return this.api.put<MapLayerDefinition>(`/MapLayers/Field/${fieldId}/Restore`, {}); }

  // ─────────── السجلات ───────────
  siteEntries(siteId: number) { return this.api.get<SiteEntries>(`/MapEntries/Site/${siteId}`); }
  createEntry(v: EntryInput) { return this.api.post<MapEntry>('/MapEntries/Create', v); }
  updateEntry(id: number, v: EntryInput) { return this.api.put<MapEntry>(`/MapEntries/Update/${id}`, v); }
  deleteEntry(id: number) { return this.api.delete<{ message: string }>(`/MapEntries/Delete/${id}`); }
}
