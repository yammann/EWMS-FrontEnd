import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { PagedResult } from '@core/models/paged-result.model';
import { DeviceService, formatCoords } from '../data-access/device.service';
import { DeviceSite, Site } from '../data-access/device.models';
import { StatTile } from '@shared/ui/stat-tile';
import { MapPoint, SyriaSvgMap } from '@features/map';
import { CopyText } from '@shared/ui/secret-text';
import { formatPhone } from '@core/utils/phone';
import { deviceUrl } from '@core/utils/network';
import { DeviceHistory, DevicePassword, InstallStatus } from '../components/device-ui';
import { LinkedTasks } from '@features/task-board';
import { MapLayersService, SiteEntriesPanel } from '@features/map-layers';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';

/**
 * صفحة تفاصيل موقع (تُفتح بالنقر على نقطة الموقع في خريطة لوحة المتابعة أو من صفحة المواقع):
 * معلومات الموقع، مكانه على خريطة المحافظة مع المواقع المجاورة، وكل الأجهزة المركّبة فيه.
 */
@Component({
  selector: 'app-site-details-page', standalone: true, imports: [Icon, EmptyState, Alert, RouterLink, StatTile, SyriaSvgMap, CopyText, DevicePassword, InstallStatus, DeviceHistory, LinkedTasks, SiteEntriesPanel, Pager],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './site-details-page.scss'],
  templateUrl: './site-details-page.html',
  
})
export class SiteDetailsPage {
  pager = new Pagination(() => this.installations());
  private service = inject(DeviceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  access = this.service.access;
  /** معلومات الفروع (طبقاتها) على الموقع — لمن يملك أي صلاحية سجلات */
  private layersAccess = inject(MapLayersService).access;
  canViewEntries = computed(() => this.layersAccess().canViewEntries);
  site = signal<Site | null>(null);
  installations = signal<DeviceSite[]>([]);
  allSites = signal<Site[]>([]);
  total = signal(0);
  historyOpen = signal(false);
  phone = formatPhone;
  url = deviceUrl;
  loading = signal(false);
  error = signal('');
  coords = formatCoords;

  /** مواقع أخرى في نفس المحافظة (المحافظة يحددها الخادم من الإحداثيات) — نقاط قابلة للنقر حول الموقع الحالي */
  nearby = computed(() => {
    const s = this.site();
    if (!s?.governorateCode) return [];
    return this.allSites().filter(o => o.id !== s.id && o.governorateCode === s.governorateCode && o.latitude != null && o.longitude != null);
  });

  points = computed<MapPoint[]>(() => {
    const s = this.site();
    if (!s || s.latitude == null || s.longitude == null) return [];
    return [
      ...this.nearby().map(n => ({ id: n.id, latitude: n.latitude!, longitude: n.longitude!, label: n.name, sub: n.governorateName })),
      { id: s.id, latitude: s.latitude, longitude: s.longitude, label: s.name, sub: 'الموقع الحالي', selected: true }
    ];
  });

  governorateSites = computed(() => this.allSites().filter(s => s.governorateCode === this.site()?.governorateCode));

  deviceTypes = computed(() => {
    const byDevice = new Map<number, { name: string; model: string; count: number }>();
    for (const i of this.installations()) {
      const t = byDevice.get(i.deviceId) ?? { name: i.deviceName, model: i.deviceModel, count: 0 };
      t.count++; byDevice.set(i.deviceId, t);
    }
    return [...byDevice.values()].sort((a, b) => b.count - a.count);
  });

  uniqueIps = computed(() => new Set(this.installations().map(i => i.ip.trim())).size);
  duplicateCount = computed(() => this.installations().filter(i => i.duplicateIp).length);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => this.load(Number(params.get('id'))));
  }

  private load(id: number) {
    // التركيبات لمن يرى الأجهزة فقط (وضمن قسمه/فرعه)؛ من يملك صلاحيات المواقع وحدها يرى بيانات الموقع
    const installations = this.access().canView
      ? this.service.installations({ siteId: id, pageSize: 200 })
      : of<PagedResult<DeviceSite>>({ items: [], totalCount: 0, page: 1, pageSize: 200, totalPages: 0 });
    this.loading.set(true); this.error.set(''); forkJoin({ site: this.service.site(id), installations, sites: this.service.sites() }).subscribe({
      next: r => { this.site.set(r.site); this.installations.set(r.installations.items); this.total.set(r.installations.totalCount); this.allSites.set(r.sites); this.loading.set(false); },
      error: e => { this.site.set(null); this.loading.set(false); this.error.set(e.message); }
    });
  }

  openSite(id: number) {
    if (id !== this.site()?.id) this.router.navigate(['/devices/sites', id]);
  }


}
