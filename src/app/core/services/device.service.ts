import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { BranchMap, Device, DeviceAccess, DeviceSite, MapBranchOption, Region, Site } from '../models/device.models';

/** يحوّل كائناً إلى FormData (الـ API يستقبل [FromForm] بأسماء الخصائص كما هي) */
function form(body: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(body)) data.append(key, String(value ?? ''));
  return data;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private api = inject(ApiService);

  /**
   * صلاحيتي على توثيق الأجهزة: المشاهدة لموظفي قسم العمليات (أو ViewDevices)،
   * والإدارة لرئيس القسم (أو ManageDevices). تُحمَّل مرة لكل جلسة.
   */
  access = signal<DeviceAccess>({ canView: false, canManage: false, inOwnerDepartment: false });
  private access$?: Observable<DeviceAccess>;

  loadAccess(force = false): Observable<DeviceAccess> {
    if (!this.access$ || force) {
      this.access$ = this.api.get<DeviceAccess>('/Devices/MyAccess').pipe(
        catchError(() => of({ canView: false, canManage: false, inOwnerDepartment: false })),
        tap(a => this.access.set(a)),
        shareReplay(1)
      );
    }
    return this.access$;
  }

  resetAccess() {
    this.access$ = undefined;
    this.access.set({ canView: false, canManage: false, inOwnerDepartment: false });
  }

  // ─────────── المناطق ───────────
  regions() { return this.api.get<Region[]>('/Regions/GetAll'); }
  createRegion(v: RegionInput) { return this.api.post<Region>('/Regions/Create', regionForm(v)); }
  updateRegion(id: number, v: RegionInput) { return this.api.put<Region>(`/Regions/Update/${id}`, regionForm(v)); }
  deleteRegion(id: number) { return this.api.delete<{ message: string }>(`/Regions/Delete/${id}`); }

  // ─────────── المواقع ───────────
  sites() { return this.api.get<Site[]>('/Sites/GetAll'); }
  site(id: number) { return this.api.get<Site>(`/Sites/Get/${id}`); }
  createSite(v: SiteInput) { return this.api.post<Site>('/Sites/Create', siteForm(v)); }
  updateSite(id: number, v: SiteInput) { return this.api.put<Site>(`/Sites/Update/${id}`, siteForm(v)); }
  deleteSite(id: number) { return this.api.delete<{ message: string }>(`/Sites/Delete/${id}`); }

  // ─────────── الأجهزة ───────────
  devices() { return this.api.get<Device[]>('/Devices/GetAll'); }
  createDevice(v: DeviceInput) { return this.api.post<Device>('/Devices/Create', deviceForm(v)); }
  updateDevice(id: number, v: DeviceInput) { return this.api.put<Device>(`/Devices/Update/${id}`, deviceForm(v)); }
  deleteDevice(id: number) { return this.api.delete<{ message: string }>(`/Devices/Delete/${id}`); }

  // ─────────── التركيبات (جهاز في موقع) ───────────
  installations(filter: { siteId?: number | null; deviceId?: number | null } = {}) {
    const q = new URLSearchParams();
    if (filter.siteId) q.set('siteId', String(filter.siteId));
    if (filter.deviceId) q.set('deviceId', String(filter.deviceId));
    return this.api.get<DeviceSite[]>(`/DeviceSites/GetAll${q.size ? '?' + q : ''}`);
  }
  createInstallation(v: InstallationInput) { return this.api.post<DeviceSite>('/DeviceSites/Create', installationForm(v)); }
  updateInstallation(id: number, v: InstallationInput) { return this.api.put<DeviceSite>(`/DeviceSites/Update/${id}`, installationForm(v)); }
  deleteInstallation(id: number) { return this.api.delete<{ message: string }>(`/DeviceSites/Delete/${id}`); }

  /** خريطة الفرع (السوبر ادمن الآن — لاحقاً رئيس كل فرع) */
  branchMap(branchId: number) { return this.api.get<BranchMap>(`/Map/Branch/${branchId}`); }
  mapBranches() { return this.api.get<MapBranchOption[]>('/Map/Branches'); }

  /** عدد العناصر المرتبطة (لإظهار الأعداد في الجداول) */
  countBy<T>(items: T[], key: (item: T) => number): Map<number, number> {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return counts;
  }
}

export interface RegionInput { name: string; description: string; latitude: number; longitude: number; }
export interface SiteInput { name: string; description: string; latitude: number; longitude: number; regionId: number; }
export interface DeviceInput { name: string; model: string; description: string; }
export interface InstallationInput {
  deviceId: number; siteId: number; ip: string; subnetMask: string; userName: string; pass: string; note: string; installLocation: string; sn: string;
}

const regionForm = (v: RegionInput) => form({ Name: v.name, Description: v.description, Latitude: v.latitude, Longitude: v.longitude });
const siteForm = (v: SiteInput) => form({ Name: v.name, Description: v.description, Latitude: v.latitude, Longitude: v.longitude, RegionId: v.regionId });
const deviceForm = (v: DeviceInput) => form({ Name: v.name, Model: v.model, Description: v.description });
const installationForm = (v: InstallationInput) => form({
  DeviceId: v.deviceId, SiteId: v.siteId, Ip: v.ip, SubnetMask: v.subnetMask, UserName: v.userName, Pass: v.pass, Note: v.note,
  InstallLocation: v.installLocation, SN: v.sn
});

/** تنسيق الإحداثيات للعرض */
export function formatCoords(lat: number | null | undefined, lng: number | null | undefined): string {
  return lat == null || lng == null ? '' : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
