import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DeviceService, formatCoords } from '@features/devices';
import { BranchMap, MapBranchOption, MapLayer, MapSite } from '@features/devices';
import { GovernorateFeature } from '@core/utils/geo';
import { ToastService } from '@shared/ui/toast.service';
import { MapPoint, SyriaSvgMap } from './syria-svg-map';
import { MapPoint3d, Syria3dMap, webglAvailable } from './syria-3d-map';
import { latestRequest } from '@shared/ui/track-request';
import { SelectValue } from '@shared/ui/select-value';
import { Icon } from '@shared/ui/icon';

/** تدرّج واحد من لون الثيم لعدد المواقع في المحافظة (متغيرات --map-* في styles/_tokens) — المحافظة بلا مواقع رمادية */
const RAMP = ['var(--map-1)', 'var(--map-2)', 'var(--map-3)', 'var(--map-4)'];
const EMPTY = 'var(--map-empty)';
/** لون طبقة بلا لون محدد (الطبقة التلقائية لمصدر من بيانات النظام) */
const DEFAULT_LAYER_COLOR = 'var(--brand-600)';

/** آخر عرض للخريطة (الفرع + المحافظة) — حتى يرجع المستخدم لنفس المكان بعد فتح صفحة موقع */
let lastView: { branchId: number; focus: string | null } | null = null;
/** الطبقات المخفية من مفتاح الخريطة (مفاتيح الطبقات) — تبقى أثناء الجلسة */
let hiddenLayers = new Set<string>();

/** طبقة الموقع في الخريطة المدمجة: عدد عناصرها فيه بوحدتها */
export interface SiteLayerRef { key: string; kind: string; title: string; color: string; count: number; unit: string; }

/** موقع واحد مهما تعددت طبقاته: نقطة واحدة بألوان طبقاته */
export interface MergedSite extends MapSite { layers: SiteLayerRef[]; }

/** عدد عناصر الطبقة في الموقع (count من الخادم؛ والحقول القديمة احتياطاً) */
const siteCount = (s: MapSite) => s.count ?? (s.installationsCount || s.entriesCount || 0);

/**
 * دمج طبقات الخريطة الظاهرة في مواقع فريدة (الموقع مشترك بين الطبقات والمصادر): نقطة واحدة بألوان طبقاته،
 * ولكل طبقة عددها بوحدتها — يدوية كانت أو من بيانات النظام، بلا معاملة خاصة لأي مصدر.
 */
export function mergeLayers(layers: readonly MapLayer[]): MergedSite[] {
  const sites = new Map<number, MergedSite>();
  for (const layer of layers) {
    const color = layer.color || DEFAULT_LAYER_COLOR;
    for (const s of layer.sites) {
      const site = sites.get(s.id) ?? { ...s, layers: [] };
      site.layers.push({ key: layer.key, kind: layer.kind, title: layer.title, color, count: siteCount(s), unit: layer.unit || '' });
      sites.set(s.id, site);
    }
  }
  return [...sites.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** وصف طبقات موقع في سطر: «تركيبات الأجهزة (3) · المشاريع (2)» */
export function describeLayers(site: MergedSite): string {
  return site.layers.map(l => `${l.title} (${l.count})`).join(' · ');
}

/** عدد كل طبقة في مجموعة مواقع (للمحافظة): «تركيبات الأجهزة 40 · المشاريع 3» */
export function layerTotals(sites: readonly MergedSite[]): { key: string; title: string; color: string; count: number }[] {
  const totals = new Map<string, { key: string; title: string; color: string; count: number }>();
  for (const s of sites)
    for (const l of s.layers) {
      const t = totals.get(l.key) ?? { key: l.key, title: l.title, color: l.color, count: 0 };
      t.count += l.count;
      totals.set(l.key, t);
    }
  return [...totals.values()];
}

/**
 * خريطة الفروع (لوحة مدير النظام: أي فرع، ولوحة من يملك ViewBranchMap: فرعه فقط ببيانات فرعه — الباك يقيّد القائمة والبيانات):
 * سوريا كقطع (المحافظات) ← النقر على قطعة يكبّرها لتملأ الإطار مع نقاط المواقع ← النقر على موقع يفتح صفحة تفاصيله
 * (devices/sites/:id). الزر الأيمن (أو Esc) يرجع إلى كل سوريا.
 *
 * الطبقات (1.2.0): مصادر بيانات النظام (التركيبات…) وطبقات الفرع؛ الموقع نقطة واحدة بألوان طبقاته، ومفتاح الطبقات يظهرها ويخفيها.
 *
 * الخريطة مثبّتة في رأس الصفحة (sticky)، وما بعدها (رأس الصفحة + الملخص + محتوى اللوحة عبر ng-content) ينزلق فوقها
 * أثناء السكرول بينما تصغر وتخفت تدريجياً حتى تنغلق.
 */
@Component({
  selector: 'app-branch-map', standalone: true, imports: [Icon, SelectValue, RouterLink, SyriaSvgMap, Syria3dMap],
  templateUrl: './branch-map.html',
  styleUrl: './branch-map.scss'
})
export class BranchMapComponent {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(DeviceService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private pinned = viewChild<ElementRef<HTMLElement>>('pinned');
  private sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  private map3d = viewChild(Syria3dMap);
  /** الخريطة ثلاثية الأبعاد بعد جاهزيتها — لزرّي التدوير وإعادة الضبط في رأس الخريطة */
  mapTools = computed(() => { const m = this.map3d(); return m && !m.loading() ? m : null; });

  branches = signal<MapBranchOption[]>([]);
  branchId = signal(0);
  data = signal<BranchMap | null>(null);
  features = signal<GovernorateFeature[]>([]);
  focus = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  hidden = signal<ReadonlySet<string>>(hiddenLayers);
  coords = formatCoords;
  /** الخريطة ثلاثية الأبعاد (2026-10-13)؛ بلا WebGL أو عند فشل تحميلها تُعرض الخريطة المسطحة */
  use3d = signal(webglAvailable());

  /** كل طبقات الفرع (للمفتاح) */
  layers = computed(() => this.data()?.layers ?? []);
  hasData = computed(() => this.layers().length > 0);
  layerColor = (l: MapLayer) => l.color || DEFAULT_LAYER_COLOR;

  /** المواقع الفريدة في الطبقات الظاهرة */
  sites = computed(() => mergeLayers(this.layers().filter(l => !this.hidden().has(l.key))));

  /** لكل محافظة: مواقعها، وعدد كل طبقة فيها */
  private govStats = computed(() => {
    const byGov = new Map<string, MergedSite[]>();
    for (const s of this.sites()) if (s.governorateCode) byGov.set(s.governorateCode, [...(byGov.get(s.governorateCode) ?? []), s]);
    const stats = new Map<string, { sites: number; layers: ReturnType<typeof layerTotals> }>();
    for (const [code, list] of byGov) stats.set(code, { sites: list.length, layers: layerTotals(list) });
    return stats;
  });

  private maxSites = computed(() => Math.max(0, ...[...this.govStats().values()].map(c => c.sites)));

  fillFor = computed(() => {
    const stats = this.govStats(); const max = this.maxSites();
    return (code: string) => {
      const n = stats.get(code)?.sites ?? 0;
      return n && max ? RAMP[Math.min(RAMP.length - 1, Math.ceil((n / max) * RAMP.length) - 1)] : EMPTY;
    };
  });
  subFor = computed(() => {
    const stats = this.govStats();
    return (code: string) => {
      const c = stats.get(code);
      if (!c) return 'لا توجد مواقع';
      return [`${c.sites} موقع`, ...c.layers.map(l => `${l.title} ${l.count}`)].join(' · ');
    };
  });
  badgeFor = computed(() => { const stats = this.govStats(); return (code: string) => stats.get(code)?.sites ?? 0; });

  legend = computed(() => {
    const max = this.maxSites();
    if (!max) return [];
    const step = Math.max(1, Math.ceil(max / RAMP.length));
    return RAMP.slice(0, Math.min(RAMP.length, max)).map((color, i) =>
      ({ color, label: step === 1 ? `${i + 1}${i === RAMP.length - 1 ? '+' : ''}` : `${i * step + 1}–${(i + 1) * step}` }));
  });

  focusName = computed(() => this.features().find(f => f.properties.code === this.focus())?.properties.nameAr ?? '');

  sitesInFocus = computed<MergedSite[]>(() => {
    const code = this.focus();
    return code ? this.sites().filter(s => s.governorateCode === code) : [];
  });

  points = computed<MapPoint[]>(() => this.sitesInFocus()
    .filter(s => s.latitude != null && s.longitude != null)
    .map(s => ({
      id: s.id, latitude: s.latitude!, longitude: s.longitude!, label: s.name,
      sub: `${s.governorateName} · ${describeLayers(s)}`,
      colors: s.layers.map(l => l.color)
    })));

  /** كل مواقع الطبقات الظاهرة للخريطة ثلاثية الأبعاد (دبابيس في عرض سوريا، ودبابيس المحافظة في عرضها) */
  allPoints = computed<MapPoint3d[]>(() => this.sites()
    .filter(s => s.latitude != null && s.longitude != null && !!s.governorateCode)
    .map(s => ({
      id: s.id, latitude: s.latitude!, longitude: s.longitude!, label: s.name, governorateCode: s.governorateCode,
      sub: `${s.governorateName} · ${describeLayers(s)}`, colors: s.layers.map(l => l.color)
    })));

  /** المحافظات التي فيها مواقع (جدول أسفل الخريطة في عرض سوريا) */
  governorateRows = computed(() => this.features()
    .map(f => ({ code: f.properties.code, name: f.properties.nameAr, ...(this.govStats().get(f.properties.code) ?? { sites: 0, layers: [] }) }))
    .filter(r => r.sites > 0)
    .sort((a, b) => b.sites - a.sites));

  /** مواقع الطبقات الظاهرة التي لا تُرسم لأنها بلا إحداثيات (تنبيه بجانب مفتاح الطبقات) */
  withoutCoordinates = computed(() => this.sites().filter(s => s.latitude == null || s.longitude == null).length);

  constructor() {
    afterNextRender(() => this.trackCollapse());

    this.service.mapBranches().subscribe({
      next: list => {
        this.branches.set(list);
        const saved = lastView && list.some(b => b.id === lastView!.branchId) ? lastView : null;
        const first = list.find(b => b.hasMapData) ?? list[0];
        if (saved) this.selectBranch(saved.branchId, saved.focus);
        else if (first) this.selectBranch(first.id);
      },
      error: e => this.error.set(e.message)
    });
  }

  /** مقدار انغلاق الخريطة (0 → 1) = نسبة ما غطّته الصفحة المنزلقة منها؛ يُكتب كمتغير CSS بدون إعادة رسم Angular */
  private trackCollapse() {
    let frame = 0;
    const update = () => {
      frame = 0;
      const pin = this.pinned()?.nativeElement; const sheet = this.sheet()?.nativeElement;
      if (!pin || !sheet) return;
      // التصغير حول الحافة العليا لا يغيّر top، وoffsetHeight لا يتأثر بالـ transform — فلا توجد حلقة تغذية راجعة
      const covered = pin.getBoundingClientRect().top + pin.offsetHeight - sheet.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, covered / pin.offsetHeight));
      pin.style.setProperty('--p', p.toFixed(3));
      pin.classList.toggle('closing', p > .35);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    update();
    this.destroyRef.onDestroy(() => {
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    });
  }

  selectBranch(id: number, focus: string | null = null) {
    this.branchId.set(id);
    this.focus.set(focus);
    lastView = { branchId: id, focus };
    this.latest(this.service.branchMap(id), this.loading, this.error, map => { this.data.set(map); });
  }

  toggleLayer(key: string) {
    const next = new Set(this.hidden());
    if (next.has(key)) next.delete(key); else next.add(key);
    hiddenLayers = next;
    this.hidden.set(next);
  }

  openGovernorate(code: string) {
    if (!this.hasData()) return;
    this.focus.set(code);
    lastView = { branchId: this.branchId(), focus: code };
  }

  /** صفحة تفاصيل الموقع — لمن يرى سجل المواقع (الخريطة وحدها لا تكفي لفتحها) */
  openSite(id: number) {
    if (!this.service.siteAccess().canView) {
      this.toast.info('تفاصيل المواقع تحتاج صلاحية عرض المواقع أو توثيق الأجهزة أو سجلات طبقات الفرع');
      return;
    }
    this.router.navigate(['/devices/sites', id]);
  }

  back() {
    this.focus.set(null);
    lastView = { branchId: this.branchId(), focus: null };
  }
}
