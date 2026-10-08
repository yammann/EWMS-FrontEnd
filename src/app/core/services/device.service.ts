import { Injectable, computed, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { AppPermission, AppPermissionName } from '../constants/access';
import {
  BranchMap, Device, DeviceAccess, DeviceInventoryLog, DeviceSite, ImportReport, InstallationFilter, InstallationStatus, IpInUse,
  MapBranchOption, Site
} from '../models/device.models';
import { PagedResult } from '../models/maintenance.models';

function query(params: object): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '' && value !== 0) q.set(key, String(value));
  }
  return q.size ? '?' + q : '';
}

/** يحفظ ملفاً نزّلته الواجهة (Blob) باسم معيّن */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /**
   * صلاحيتي على توثيق الأجهزة (Role-Permission): من يضيف أو يعدّل أو يحذف يرى ما يعمل عليه (سياسة AnyDeviceView في الباكاند).
   * كلمات السر صلاحية مستقلة. تتحدّث تلقائياً مع تغيّر صلاحيات المستخدم.
   */
  access = computed<DeviceAccess>(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    const canCreate = has(AppPermission.CreateDevice);
    const canEdit = has(AppPermission.EditDevice);
    const canDelete = has(AppPermission.DeleteDevice);
    return {
      canView: has(AppPermission.ViewDevices) || canCreate || canEdit || canDelete,
      canCreate, canEdit, canDelete,
      canManage: canCreate || canEdit || canDelete,
      canRevealPasswords: has(AppPermission.RevealDevicePasswords)
    };
  });

  // ─────────── المواقع ───────────
  sites() { return this.api.get<Site[]>('/Sites/GetAll'); }
  site(id: number) { return this.api.get<Site>(`/Sites/Get/${id}`); }
  createSite(v: SiteInput) { return this.api.post<Site>('/Sites/Create', v); }
  updateSite(id: number, v: SiteInput) { return this.api.put<Site>(`/Sites/Update/${id}`, v); }
  deleteSite(id: number) { return this.api.delete<{ message: string }>(`/Sites/Delete/${id}`); }

  // ─────────── كتالوج الأجهزة ───────────
  devices() { return this.api.get<Device[]>('/Devices/GetAll'); }
  createDevice(v: DeviceInput) { return this.api.post<Device>('/Devices/Create', v); }
  updateDevice(id: number, v: DeviceInput) { return this.api.put<Device>(`/Devices/Update/${id}`, v); }
  deleteDevice(id: number) { return this.api.delete<{ message: string }>(`/Devices/Delete/${id}`); }

  // ─────────── التركيبات (جهاز في موقع) ───────────
  installations(filter: InstallationFilter) {
    return this.api.get<PagedResult<DeviceSite>>('/DeviceSites/Search' + query(filter));
  }
  installation(id: number) { return this.api.get<DeviceSite>(`/DeviceSites/Get/${id}`); }
  createInstallation(v: InstallationInput) { return this.api.post<DeviceSite>('/DeviceSites/Create', v); }
  updateInstallation(id: number, v: InstallationInput) { return this.api.put<DeviceSite>(`/DeviceSites/Update/${id}`, v); }
  deleteInstallation(id: number) { return this.api.delete<{ message: string }>(`/DeviceSites/Delete/${id}`); }
  verifyInstallation(id: number) { return this.api.put<DeviceSite>(`/DeviceSites/Verify/${id}`, {}); }
  /** تركيبات أخرى بنفس الـ IP في الموقع (تنبيه النموذج) */
  ipInUse(siteId: number, ip: string, excludeId: number | null) {
    return this.api.get<IpInUse[]>('/DeviceSites/IpInUse' + query({ siteId, ip, excludeId }));
  }
  /** كلمة السر عند الطلب فقط — يُسجَّل في الخادم كإظهار أو نسخ */
  revealPassword(id: number, copy: boolean) {
    return this.api.get<{ password: string }>(`/DeviceSites/Password/${id}` + query({ copy: copy || undefined })).pipe(map(r => r.password));
  }

  // ─────────── السجل ───────────
  history(kind: 'site' | 'device' | 'installation', id: number, page = 1) {
    const base = kind === 'site' ? '/Sites' : kind === 'device' ? '/Devices' : '/DeviceSites';
    return this.api.get<PagedResult<DeviceInventoryLog>>(`${base}/History/${id}` + query({ page, pageSize: 20 }));
  }

  // ─────────── Excel ───────────
  exportInstallations(filter: InstallationFilter) {
    return this.api.getBlob('/DeviceSites/Export' + query({ ...filter, page: undefined, pageSize: undefined }));
  }
  importTemplate() { return this.api.getBlob('/DeviceSites/ImportTemplate'); }
  importInstallations(file: File, dryRun: boolean) {
    const body = new FormData();
    body.append('file', file);
    return this.api.post<ImportReport>(`/DeviceSites/Import?dryRun=${dryRun}`, body);
  }

  /** خريطة الفرع */
  branchMap(branchId: number) { return this.api.get<BranchMap>(`/Map/Branch/${branchId}`); }
  mapBranches() { return this.api.get<MapBranchOption[]>('/Map/Branches'); }
}

export interface SiteInput {
  name: string; description: string; latitude: number; longitude: number;
  contactName: string; contactPhone: string; responsibleParty: string; rowVersion?: string | null;
}
export interface DeviceInput { name: string; model: string; description: string; category: string; manufacturer: string; rowVersion?: string | null; }
export interface InstallationInput {
  deviceId: number; siteId: number; ip: string; subnetMask: string; gateway: string; userName: string;
  /** عند التعديل: فارغة = تبقى كلمة السر الحالية */
  pass: string;
  note: string; installLocation: string; sn: string; macAddress: string; port: string; vlan: number | null; firmware: string;
  installDate: string | null; status: InstallationStatus; rowVersion?: string | null;
}

/** تنسيق الإحداثيات للعرض */
export function formatCoords(lat: number | null | undefined, lng: number | null | undefined): string {
  return lat == null || lng == null ? '' : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
