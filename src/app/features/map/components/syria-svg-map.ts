import { Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Box, GOVERNORATES_ATTRIBUTION, GovernorateFeature, ProjectedGovernorate, SyriaGeoService, SyriaProjection, projectSyria } from '@core/utils/geo';
import { STAMP_LANDMARKS, Stamp } from '@shared/ui/stamp';

export interface MapPoint {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
  sub?: string;
  selected?: boolean;
}

interface Tip { x: number; y: number; title: string; sub: string; /** رمز المحافظة — يعرض طابعها في التلميح */ code?: string; }

const PAD = 24;               // هامش حول سوريا (بوحدات الإسقاط)
const ZOOM_MS = 550;

/**
 * خريطة سوريا بـ SVG خالص (بدون مكتبات خرائط وبدون إنترنت):
 * - كل محافظة قطعة مستقلة (مثل قطع البازل) بفاصل أبيض؛ عند المرور ترتفع القطعة مع ظل.
 * - النقر على قطعة → الأب يضبط focus → تكبير سلس حتى تملأ المحافظة الإطار وتظهر النقاط.
 * - pickable: في وضع المحافظة، النقر يحدد إحداثيات (منتقي الإحداثيات في النماذج).
 */
@Component({
  selector: 'app-syria-svg-map', standalone: true, imports: [Stamp],
  host: { '[class.bare]': '!framed()' },
  templateUrl: './syria-svg-map.html',
  styleUrl: './syria-svg-map.scss'
})
export class SyriaSvgMap implements OnDestroy {
  private geo = inject(SyriaGeoService);
  private svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private stage = viewChild<ElementRef<HTMLElement>>('stage');

  /** رمز المحافظة المعروضة (null = كل سوريا) */
  focus = input<string | null>(null);
  points = input<MapPoint[]>([]);
  pickable = input(false);
  /** ارتفاع الإطار — الخريطة تتوسطه بنسبتها الصحيحة */
  height = input('min(66vh, 600px)');
  /** false = بلا خلفية/إطار حول الخريطة (تملأ مكانها في الصفحة مباشرة) */
  framed = input(true);
  /** طوابع المحافظات (الهوية البصرية): في تلميح المحافظة وفي زاوية المحافظة المعروضة */
  showStamp = input(true);
  /** لون كل قطعة (للتلوين حسب إحصائية) */
  fillFor = input<(code: string) => string>(() => '#e3e8ef');
  /** نص التلميح الثانوي لكل محافظة */
  subFor = input<(code: string) => string>(() => '');
  /** شارة رقمية فوق المحافظة (0 = بدون شارة) */
  badgeFor = input<(code: string) => number>(() => 0);

  governorateSelect = output<string>();
  pointSelect = output<number>();
  pick = output<{ latitude: number; longitude: number }>();
  ready = output<GovernorateFeature[]>();
  /** الرجوع مستوى للأعلى: زر الفأرة الأيمن (أو ضغطة مطوّلة باللمس) أو Esc — فقط عند عرض محافظة */
  back = output<void>();

  attribution = GOVERNORATES_ATTRIBUTION;
  protected landmark = (code: string) => STAMP_LANDMARKS[code] ?? null;
  projection = signal<SyriaProjection | null>(null);
  hovered = signal<string | null>(null);
  tip = signal<Tip | null>(null);
  private box = signal<Box>({ x: 0, y: 0, w: 1000, h: 800 });
  private frame = 0;
  /** حجم الخريطة الفعلي على الشاشة (px) — لحساب مقياس الرسم */
  private size = signal({ w: 0, h: 0 });
  private resize?: ResizeObserver;

  govs = computed(() => this.projection()?.governorates ?? []);
  focused = computed(() => this.govs().find(g => g.code === this.focus()) ?? null);
  hoveredGov = computed(() => this.govs().find(g => g.code === this.hovered()) ?? null);
  viewBox = computed(() => { const b = this.box(); return `${b.x} ${b.y} ${b.w} ${b.h}`; });
  /** معامل التكبير الحالي — لإبقاء أحجام النقاط والنصوص ثابتة على الشاشة */
  z = computed(() => {
    const b = this.box(); const { w, h } = this.size();
    if (!w || !h) { const p = this.projection(); return p ? b.w / (p.width + PAD * 2) : 1; }
    return 1 / Math.min(w / b.w, h / b.h);   // وحدات الرسم لكل بكسل (preserveAspectRatio = meet)
  });

  projectedPoints = computed(() => {
    const p = this.projection();
    if (!p || !this.focus()) return [];
    return this.points().map(pt => { const [x, y] = p.project(pt.latitude, pt.longitude); return { ...pt, x, y }; });
  });
  showPointLabels = computed(() => this.projectedPoints().length <= 12);

  constructor() {
    this.geo.governorates().subscribe(data => {
      const projection = projectSyria(data.features);
      this.projection.set(projection);
      this.box.set(this.fullBox(projection));
      // الملف مخزّن مؤقتاً بعد أول تحميل فيصل هنا بشكل متزامن داخل الـ constructor، أي قبل أن يربط الأب (ready)؛
      // التأجيل لـ microtask يضمن وصول الحدث للأب دائماً
      queueMicrotask(() => this.ready.emit(data.features));
    });

    // مراقبة حجم الخريطة: النقاط والنصوص بحجم ثابت على الشاشة مهما كان ارتفاع الإطار أو مستوى التكبير
    effect(() => {
      const svg = this.svg()?.nativeElement;
      if (!svg || typeof ResizeObserver === 'undefined') return;
      untracked(() => {
        this.resize?.disconnect();
        this.resize = new ResizeObserver(([entry]) => this.size.set({ w: entry.contentRect.width, h: entry.contentRect.height }));
        this.resize.observe(svg);
      });
    });

    // التكبير/التصغير السلس عند تغيّر المحافظة المعروضة
    effect(() => {
      const projection = this.projection();
      const gov = this.focused();
      if (!projection) return;
      untracked(() => { this.hovered.set(null); this.tip.set(null); this.animateTo(gov ? this.govBox(gov) : this.fullBox(projection)); });
    });
  }

  ngOnDestroy() { cancelAnimationFrame(this.frame); this.resize?.disconnect(); }

  // ─────────── التفاعل ───────────

  hover(g: ProjectedGovernorate, event: MouseEvent) {
    if (this.focus() === g.code) return;
    if (this.focus()) { this.moveTip(event, g.nameAr, 'انقر للانتقال إليها', g.code); return; }
    this.hovered.set(g.code);
    this.moveTip(event, g.nameAr, this.subFor()(g.code), g.code);
  }

  unhover() { this.hovered.set(null); this.tip.set(null); }

  moveTip(event: MouseEvent, title?: string, sub?: string, code?: string) {
    const stage = this.stage()?.nativeElement.getBoundingClientRect();
    if (!stage) return;
    const current = this.tip();
    this.tip.set({
      x: event.clientX - stage.left,
      y: event.clientY - stage.top,
      title: title ?? current?.title ?? '',
      sub: sub ?? current?.sub ?? '',
      // التلميح الجديد (عنوان جديد) يأخذ رمزه فقط؛ الحركة داخل نفس العنصر تُبقي الرمز
      code: title !== undefined ? code : current?.code
    });
  }

  selectGovernorate(g: ProjectedGovernorate, event: Event) {
    if (this.focus() === g.code) return;   // النقر داخل المحافظة المعروضة للتحديد (pickable) وليس للتنقل
    event.stopPropagation();               // محافظة مجاورة (باهتة) → الانتقال إليها
    this.governorateSelect.emit(g.code);
  }

  goBack(event: Event) {
    if (!this.focus()) return;        // في عرض سوريا تبقى القائمة المعتادة للمتصفح
    event.preventDefault();
    this.unhover();
    this.back.emit();
  }

  selectPoint(id: number, event: Event) {
    event.stopPropagation();
    this.pointSelect.emit(id);
  }

  /** تحويل النقر إلى إحداثيات (وضع المحافظة + pickable) */
  svgClick(event: MouseEvent) {
    const svg = this.svg()?.nativeElement;
    const projection = this.projection();
    if (!svg || !projection || !this.pickable() || !this.focus()) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX; pt.y = event.clientY;
    const local = pt.matrixTransform(matrix.inverse());
    const [lat, lng] = projection.invert(local.x, local.y);
    const round = (v: number) => Math.round(v * 1e5) / 1e5;
    this.pick.emit({ latitude: round(lat), longitude: round(lng) });
  }

  // ─────────── التكبير ───────────

  private fullBox(p: SyriaProjection): Box {
    return { x: -PAD, y: -PAD, w: p.width + PAD * 2, h: p.height + PAD * 2 };
  }

  private govBox(g: ProjectedGovernorate): Box {
    const m = Math.max(g.box.w, g.box.h) * 0.08;
    return { x: g.box.x - m, y: g.box.y - m, w: g.box.w + m * 2, h: g.box.h + m * 2 };
  }

  private animateTo(target: Box) {
    cancelAnimationFrame(this.frame);
    const from = this.box();
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { this.box.set(target); return; }
    const start = performance.now();
    const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const k = ease(t);
      this.box.set({
        x: from.x + (target.x - from.x) * k,
        y: from.y + (target.y - from.y) * k,
        w: from.w + (target.w - from.w) * k,
        h: from.h + (target.h - from.h) * k
      });
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
