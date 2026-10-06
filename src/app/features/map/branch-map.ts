import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DeviceService, formatCoords } from '../../core/services/device.service';
import { BranchMap, MapBranchOption, MapSite } from '../../core/models/device.models';
import { GovernorateFeature } from '../../core/utils/geo';
import { ToastService } from '../../shared/ui/toast.service';
import { MapPoint, SyriaSvgMap } from './syria-svg-map';

/** تدرّج واحد من لون الثيم لعدد المواقع في المحافظة (متغيرات --map-* في styles/_tokens) — المحافظة بلا مواقع رمادية */
const RAMP = ['var(--map-1)', 'var(--map-2)', 'var(--map-3)', 'var(--map-4)'];
const EMPTY = 'var(--map-empty)';

/** آخر عرض للخريطة (الفرع + المحافظة) — حتى يرجع المستخدم لنفس المكان بعد فتح صفحة موقع */
let lastView: { branchId: number; focus: string | null } | null = null;

/**
 * خريطة الفروع (لوحة مدير النظام: أي فرع، ولوحة من يملك ViewBranchMap: فرعه فقط ببيانات فرعه — الباك يقيّد القائمة والبيانات):
 * سوريا كقطع (المحافظات) ← النقر على قطعة يكبّرها لتملأ الإطار مع نقاط المواقع ← النقر على موقع يفتح صفحة تفاصيله
 * (devices/sites/:id). الزر الأيمن (أو Esc) يرجع إلى كل سوريا.
 *
 * الخريطة مثبّتة في رأس الصفحة (sticky)، وما بعدها (رأس الصفحة + الملخص + محتوى اللوحة عبر ng-content) ينزلق فوقها
 * أثناء السكرول بينما تصغر وتخفت تدريجياً حتى تنغلق.
 */
@Component({
  selector: 'app-branch-map', standalone: true, imports: [RouterLink, SyriaSvgMap],
  templateUrl: './branch-map.html',
  styleUrl: './branch-map.scss'
})
export class BranchMapComponent {
  private service = inject(DeviceService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private pinned = viewChild<ElementRef<HTMLElement>>('pinned');
  private sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  branches = signal<MapBranchOption[]>([]);
  branchId = signal(0);
  data = signal<BranchMap | null>(null);
  features = signal<GovernorateFeature[]>([]);
  focus = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  coords = formatCoords;

  layer = computed(() => this.data()?.devicesLayer ?? null);

  /** المحافظة (code) لكل موقع — يحددها الخادم من الإحداثيات ويحفظها مع الموقع (مصدر واحد) */
  private siteGov = computed(() => {
    const result = new Map<number, string>();
    for (const s of this.layer()?.sites ?? []) if (s.governorateCode) result.set(s.id, s.governorateCode);
    return result;
  });

  private govStats = computed(() => {
    const stats = new Map<string, { sites: number; installations: number }>();
    const siteGov = this.siteGov();
    for (const s of this.layer()?.sites ?? []) {
      const code = siteGov.get(s.id);
      if (!code) continue;
      const c = stats.get(code) ?? { sites: 0, installations: 0 };
      c.sites++; c.installations += s.installationsCount;
      stats.set(code, c);
    }
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
    return (code: string) => { const c = stats.get(code); return c ? `${c.sites} موقع · ${c.installations} تركيب` : 'لا توجد مواقع'; };
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

  sitesInFocus = computed<MapSite[]>(() => {
    const code = this.focus(); const siteGov = this.siteGov();
    return code ? (this.layer()?.sites ?? []).filter(s => siteGov.get(s.id) === code) : [];
  });

  points = computed<MapPoint[]>(() => {
    return this.sitesInFocus()
      .filter(s => s.latitude != null && s.longitude != null)
      .map(s => ({ id: s.id, latitude: s.latitude!, longitude: s.longitude!, label: s.name, sub: `${s.governorateName} · ${s.installationsCount} تركيب` }));
  });

  /** المحافظات التي فيها مواقع (جدول أسفل الخريطة في عرض سوريا) */
  governorateRows = computed(() => this.features()
    .map(f => ({ code: f.properties.code, name: f.properties.nameAr, ...(this.govStats().get(f.properties.code) ?? { sites: 0, installations: 0 }) }))
    .filter(r => r.sites > 0)
    .sort((a, b) => b.sites - a.sites));

  totals = computed(() => {
    const layer = this.layer();
    return {
      sites: layer?.sites.length ?? 0,
      installations: layer?.sites.reduce((sum, s) => sum + s.installationsCount, 0) ?? 0,
      governorates: this.governorateRows().length
    };
  });

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
    this.loading.set(true); this.error.set('');
    this.service.branchMap(id).subscribe({
      next: map => { this.data.set(map); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e.message); }
    });
  }

  openGovernorate(code: string) {
    if (!this.layer()) return;
    this.focus.set(code);
    lastView = { branchId: this.branchId(), focus: code };
  }

  /** صفحة تفاصيل الموقع — لمن يملك عرض توثيق الأجهزة فقط (الخريطة وحدها لا تكفي لفتحها) */
  openSite(id: number) {
    if (!this.service.access().canView) {
      this.toast.info('تفاصيل المواقع وأجهزتها تحتاج صلاحية عرض توثيق الأجهزة');
      return;
    }
    this.router.navigate(['/devices/sites', id]);
  }

  back() {
    this.focus.set(null);
    lastView = { branchId: this.branchId(), focus: null };
  }
}
