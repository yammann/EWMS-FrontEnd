import { Injectable, computed, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '@env/environment';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName } from '@core/constants/access';
import { EntryInput, LayerInput, MapEntry, MapEntryFile, MapFileOptions, MapLayerDefinition, MapSource, SiteEntries } from './map-layers.models';

/** طبقات خرائط الفروع وسجلاتها (api/MapLayers و api/MapEntries) */
@Injectable({ providedIn: 'root' })
export class MapLayersService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private fileOptions$?: Observable<MapFileOptions>;

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

  /** مصادر بيانات النظام وفلاترها من بيانات الفرع (branchId لنظرة المؤسسة؛ وإلا فرعي) */
  sources(branchId: number | null) {
    return this.api.get<MapSource[]>('/MapLayers/Sources' + (branchId ? `?branchId=${branchId}` : ''));
  }

  /** سقف حجم الملف ومجموعات الصيغ — يُجلب مرة في الجلسة */
  fileOptions() {
    return this.fileOptions$ ??= this.api.get<MapFileOptions>('/MapLayers/FileOptions').pipe(shareReplay({ bufferSize: 1, refCount: false }));
  }

  // ─────────── ملفات حقول «ملفات» ───────────
  /** رفع ملف واحد لحقل (يبقى معلّقاً حتى يُحفظ السجل) — مع أحداث التقدّم */
  uploadFile(fieldId: number, file: File): Observable<HttpEvent<MapEntryFile>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MapEntryFile>(`${environment.apiUrl}/MapEntries/Files?fieldId=${fieldId}`, form, { reportProgress: true, observe: 'events' });
  }
  fileBlob(id: number) { return this.api.getBlob(`/MapEntries/File/${id}`); }
  /** حذف ملف معلّق رفعته ولم أحفظ السجل (إلغاء النموذج) */
  deletePendingFile(id: number) { return this.api.delete<{ message: string }>(`/MapEntries/File/${id}`); }

  // ─────────── السجلات ───────────
  siteEntries(siteId: number) { return this.api.get<SiteEntries>(`/MapEntries/Site/${siteId}`); }
  createEntry(v: EntryInput) { return this.api.post<MapEntry>('/MapEntries/Create', v); }
  updateEntry(id: number, v: EntryInput) { return this.api.put<MapEntry>(`/MapEntries/Update/${id}`, v); }
  deleteEntry(id: number) { return this.api.delete<{ message: string }>(`/MapEntries/Delete/${id}`); }
}
