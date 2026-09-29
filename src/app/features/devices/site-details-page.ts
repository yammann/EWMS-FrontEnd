import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService, formatCoords } from '../../core/services/device.service';
import { DeviceSite, Site } from '../../core/models/device.models';
import { GovernorateFeature, governorateOf } from '../../core/utils/geo';
import { StatTile } from '../dashboard/dashboard-widgets';
import { MapPoint, SyriaSvgMap } from '../map/syria-svg-map';

/**
 * صفحة تفاصيل موقع (تُفتح بالنقر على نقطة الموقع في خريطة لوحة المتابعة أو من صفحة المواقع):
 * معلومات الموقع، مكانه على خريطة المحافظة مع المواقع المجاورة، وكل الأجهزة المركّبة فيه.
 */
@Component({
  selector: 'app-site-details-page', standalone: true, imports: [RouterLink, StatTile, SyriaSvgMap],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">توثيق الأجهزة · تفاصيل الموقع</span>
          <h1>{{ site()?.name || (loading() ? 'جارٍ التحميل…' : 'الموقع') }}</h1>
          @if (site(); as s) { <p class="muted">{{ s.regionName }}{{ governorate() ? ' · محافظة ' + governorate()!.properties.nameAr : '' }}</p> }
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" type="button" (click)="goBack()">→ رجوع</button>
          @if (site(); as s) {
            <a class="btn" [routerLink]="['/devices/installations']" [queryParams]="{ siteId: s.id }">{{ access().canManage ? 'إدارة التركيبات' : 'صفحة التركيبات' }}</a>
          }
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (site(); as s) {
        <section class="site-stats" aria-label="ملخص الموقع">
          <app-stat-tile label="التركيبات" [value]="installations().length" icon="🔌" tone="green" hint="أجهزة مركّبة في الموقع" />
          <app-stat-tile label="أنواع الأجهزة" [value]="deviceTypes().length" icon="🧩" tone="blue" />
          <app-stat-tile label="عناوين IP" [value]="uniqueIps()" icon="🌐" tone="purple" [hint]="duplicateCount() ? duplicateCount() + ' تركيب بعنوان مكرر' : 'بدون تكرار'" [alert]="duplicateCount() > 0" />
          <app-stat-tile label="مواقع المنطقة" [value]="regionSites().length" icon="📍" tone="orange" [hint]="s.regionName" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>معلومات الموقع</h2></div></div>
          <dl class="facts">
            <div><dt>اسم الموقع</dt><dd>{{ s.name }}</dd></div>
            <div><dt>المنطقة</dt><dd>{{ s.regionName }}</dd></div>
            <div><dt>المحافظة</dt><dd>{{ governorate()?.properties?.nameAr || (s.latitude != null ? 'خارج حدود المحافظات' : '—') }}</dd></div>
            <div><dt>الإحداثيات</dt><dd>
              @if (coords(s.latitude, s.longitude); as c) {
                <span class="secret"><span class="mono">{{ c }}</span><button type="button" class="icon-btn-sm" (click)="copy(c, 'الإحداثيات')" aria-label="نسخ الإحداثيات">⧉</button></span>
              } @else { <span class="missing">⚠ بلا إحداثيات — لا يظهر على الخريطة</span> }
            </dd></div>
            <div class="wide"><dt>الوصف</dt><dd>{{ s.description || '—' }}</dd></div>
          </dl>
        </section>

        @if (s.latitude != null && s.longitude != null) {
          <section class="panel">
            <div class="panel-heading"><div><h2>الموقع على الخريطة</h2><p>{{ nearby().length ? 'النقاط الأخرى مواقع في نفس المحافظة — انقر عليها لفتح صفحتها' : 'لا توجد مواقع أخرى في هذه المحافظة' }}</p></div></div>
            <app-syria-svg-map [focus]="governorate()?.properties?.code ?? null" [points]="points()" height="min(52vh, 440px)"
                               (ready)="features.set($event)" (pointSelect)="openSite($event)" />
          </section>
        }

        <section class="panel">
          <div class="panel-heading"><div><h2>الأجهزة المركّبة <span class="count">({{ installations().length }})</span></h2><p>كلمات السر مخفية — اضغط 👁 للإظهار أو ⧉ للنسخ</p></div></div>
          @if (!installations().length) { <p class="empty-state">لا توجد أجهزة مركّبة في هذا الموقع بعد</p> }
          @else {
            <div class="table-wrap"><table>
              <thead><tr><th>الجهاز</th><th>الرقم التسلسلي</th><th>مكان التركيب</th><th>IP</th><th>Subnet</th><th>المستخدم</th><th>كلمة السر</th><th>ملاحظات</th></tr></thead>
              <tbody>
                @for (i of installations(); track i.id) {
                  <tr>
                    <td><strong class="cell-strong">{{ i.deviceName }}</strong>@if (i.deviceModel) { <small class="sub">{{ i.deviceModel }}</small> }</td>
                    <td>@if (i.sn) { <span class="mono">{{ i.sn }}</span> } @else { — }</td>
                    <td class="wrap">{{ i.installLocation || '—' }}</td>
                    <td><span class="secret"><span class="mono">{{ i.ip }}</span><button type="button" class="icon-btn-sm" (click)="copy(i.ip, 'IP')" [attr.aria-label]="'نسخ ' + i.ip">⧉</button>@if (isDuplicate(i)) { <span class="dup" title="يوجد أكثر من تركيب بنفس الـ IP في هذا الموقع">⚠ مكرر</span> }</span></td>
                    <td><span class="mono">{{ i.subnetMask }}</span></td>
                    <td><span class="secret"><span class="mono">{{ i.userName }}</span><button type="button" class="icon-btn-sm" (click)="copy(i.userName, 'اسم المستخدم')" aria-label="نسخ اسم المستخدم">⧉</button></span></td>
                    <td><span class="secret">
                      <span class="mono">{{ revealed().has(i.id) ? i.pass : '••••••••' }}</span>
                      <button type="button" class="icon-btn-sm" (click)="toggle(i.id)" [attr.aria-label]="revealed().has(i.id) ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'" [attr.aria-pressed]="revealed().has(i.id)">{{ revealed().has(i.id) ? '🙈' : '👁' }}</button>
                      <button type="button" class="icon-btn-sm" (click)="copy(i.pass, 'كلمة السر')" aria-label="نسخ كلمة السر">⧉</button>
                    </span></td>
                    <td class="wrap">{{ i.note || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          }
        </section>

        @if (deviceTypes().length) {
          <section class="panel">
            <div class="panel-heading"><div><h2>أنواع الأجهزة في الموقع</h2></div></div>
            <div class="types">
              @for (t of deviceTypes(); track t.name) {
                <span class="type-chip"><strong>{{ t.name }}</strong>@if (t.model) { <small>{{ t.model }}</small> }<b>{{ t.count }}</b></span>
              }
            </div>
          </section>
        }
      } @else if (loading()) {
        <div class="panel empty-state" role="status">جارٍ تحميل تفاصيل الموقع…</div>
      }

      @if (copied()) { <div class="copied" role="status">{{ copied() }}</div> }
    </div>`,
  styles: [`
    .site-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .panel { padding: 22px; }
    .panel-heading p { margin: 4px 0 0; font-size: 12px; color: var(--ink-500); }
    .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px 20px; margin: 0; }
    .facts > div { display: grid; gap: 4px; min-width: 0; }
    .facts .wide { grid-column: 1 / -1; }
    .facts dt { font-size: 12px; font-weight: 700; color: var(--ink-500); }
    .facts dd { margin: 0; font-size: 14px; font-weight: 700; color: var(--ink-900); overflow-wrap: anywhere; }
    .facts .wide dd { font-weight: 500; line-height: 1.8; white-space: pre-line; }
    .sub { display: block; color: var(--ink-500); font-size: 12px; }
    .dup { font-size: 11px; font-weight: 800; color: var(--warning-700); background: var(--warning-50); border: 1px solid var(--warning-300); border-radius: 999px; padding: 1px 8px; }
    .types { display: flex; flex-wrap: wrap; gap: 10px; }
    .type-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 13px; }
    .type-chip small { color: var(--ink-500); }
    .type-chip b { min-width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; background: var(--brand-50); color: var(--brand-700); font-size: 12px; }
    @media (max-width: 1100px) { .site-stats, .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .site-stats, .facts { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class SiteDetailsPage {
  private service = inject(DeviceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  access = this.service.access;
  site = signal<Site | null>(null);
  installations = signal<DeviceSite[]>([]);
  allSites = signal<Site[]>([]);
  features = signal<GovernorateFeature[]>([]);
  revealed = signal(new Set<number>());
  loading = signal(false);
  error = signal('');
  copied = signal('');
  coords = formatCoords;

  governorate = computed(() => { const s = this.site(); return s ? governorateOf(s.latitude, s.longitude, this.features()) : null; });

  /** مواقع أخرى في نفس المحافظة (تظهر كنقاط قابلة للنقر حول الموقع الحالي) */
  nearby = computed(() => {
    const gov = this.governorate(); const current = this.site()?.id;
    if (!gov) return [];
    return this.allSites().filter(s => s.id !== current && governorateOf(s.latitude, s.longitude, [gov]) === gov);
  });

  points = computed<MapPoint[]>(() => {
    const s = this.site();
    if (!s || s.latitude == null || s.longitude == null) return [];
    return [
      ...this.nearby().map(n => ({ id: n.id, latitude: n.latitude!, longitude: n.longitude!, label: n.name, sub: n.regionName })),
      { id: s.id, latitude: s.latitude, longitude: s.longitude, label: s.name, sub: 'الموقع الحالي', selected: true }
    ];
  });

  regionSites = computed(() => this.allSites().filter(s => s.regionId === this.site()?.regionId));

  deviceTypes = computed(() => {
    const byDevice = new Map<number, { name: string; model: string; count: number }>();
    for (const i of this.installations()) {
      const t = byDevice.get(i.deviceId) ?? { name: i.deviceName, model: i.deviceModel, count: 0 };
      t.count++; byDevice.set(i.deviceId, t);
    }
    return [...byDevice.values()].sort((a, b) => b.count - a.count);
  });

  private ipCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.installations()) { const ip = i.ip.trim(); counts.set(ip, (counts.get(ip) ?? 0) + 1); }
    return counts;
  });
  uniqueIps = computed(() => this.ipCounts().size);
  duplicateCount = computed(() => this.installations().filter(i => this.isDuplicate(i)).length);

  constructor() {
    this.service.loadAccess().subscribe();
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => this.load(Number(params.get('id'))));
  }

  private load(id: number) {
    this.loading.set(true); this.error.set(''); this.revealed.set(new Set());
    forkJoin({ site: this.service.site(id), installations: this.service.installations({ siteId: id }), sites: this.service.sites() }).subscribe({
      next: r => { this.site.set(r.site); this.installations.set(r.installations); this.allSites.set(r.sites); this.loading.set(false); },
      error: e => { this.site.set(null); this.loading.set(false); this.error.set(e.message); }
    });
  }

  isDuplicate(i: DeviceSite) { return (this.ipCounts().get(i.ip.trim()) ?? 0) > 1; }

  openSite(id: number) {
    if (id !== this.site()?.id) this.router.navigate(['/devices/sites', id]);
  }

  /** الرجوع للصفحة السابقة (الخريطة غالباً) — أو للوحة المتابعة إن فُتحت الصفحة مباشرة */
  goBack() {
    if (history.length > 1) this.location.back();
    else this.router.navigateByUrl('/');
  }

  toggle(id: number) {
    this.revealed.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => this.flash(`تم نسخ ${label}`),
      () => this.flash('تعذر النسخ — انسخ يدوياً'));
  }

  private flash(message: string) {
    this.copied.set(message);
    setTimeout(() => this.copied.set(''), 2000);
  }
}
