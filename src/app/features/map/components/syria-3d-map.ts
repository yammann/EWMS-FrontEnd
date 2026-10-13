import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { GOVERNORATES_ATTRIBUTION, GovernorateFeature, SyriaGeoService } from '@core/utils/geo';
import { Icon } from '@shared/ui/icon';
import { MapPoint } from './syria-svg-map';

type Three = typeof import('three');
type Ring = [number, number][];

/** موقع في المشهد: نقطة الخريطة + رمز محافظته */
export interface MapPoint3d extends MapPoint { governorateCode: string; }

/** هل يدعم المتصفح WebGL؟ (من دونه تُعرض الخريطة المسطحة SyriaSvgMap) */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

const LNG0 = 38.6, LAT0 = 34.85, SCALE = 9, K = Math.cos(LAT0 * Math.PI / 180);
const project = (lng: number, lat: number): [number, number] => [(lng - LNG0) * K * SCALE, (lat - LAT0) * SCALE];
/** محافظات صغيرة داخل جاراتها (دمشق، القنيطرة): أعلى قليلاً حتى تبرز ويسهل الوصول إليها */
const SMALL = new Set(['SY01', 'SY14']);
/** عرض المحافظة في عرضها المنفصل، وارتفاعها الأقصى فيه (بوحدات المشهد) */
const FIT = 40, ISO_HEIGHT = 4;
const HOME = { target: [-2, 0, 2] as const, camera: [6, 52, 50] as const };

interface Piece { code: string; name: string; feature: GovernorateFeature; center: [number, number]; depth: number; lift: number; mesh: import('three').Mesh; edges: import('three').LineSegments; }
interface Pin { point: MapPoint3d; piece: Piece; group: import('three').Group; head: import('three').Mesh; h: number; scale: number; }

/**
 * خريطة سوريا ثلاثية الأبعاد (Three.js، تُحمَّل عند الطلب ومضمّنة في الحزمة — بلا إنترنت؛ قرار المستخدم 2026-10-13):
 * - كل محافظة قطعة مجسّمة يرتفع سطحها حسب عدد مواقعها (badgeFor)، ولونها من fillFor (متغيرات الثيم).
 * - المواقع دبابيس مجسّمة بلون طبقتها الأولى؛ الضغط على دبوس = pointSelect.
 * - الضغط على محافظة (أو اسمها، أو من قائمة «انتقال إلى محافظة») = governorateSelect؛ وحين يضبط الأب focus
 *   تختفي الباقية وتنتقل المحافظة إلى الوسط مكبّرة كخريطة منفصلة. الزر الأيمن أو Esc = back.
 * - السحب للتدوير والعجلة للتكبير. الرسم عند الحاجة فقط (أثناء الحركة والتفاعل) ثم يتوقف.
 * - بلا WebGL أو عند فشل التحميل يطلق failed فيعرض الأب الخريطة المسطحة.
 */
@Component({
  selector: 'app-syria-3d-map', standalone: true, imports: [Icon],
  templateUrl: './syria-3d-map.html',
  styleUrl: './syria-3d-map.scss',
  host: { '(document:keydown.escape)': 'escape()' }
})
export class Syria3dMap {
  focus = input<string | null>(null);
  /** كل المواقع الظاهرة (برموز محافظاتها) — في عرض المحافظة تظهر دبابيسها فقط */
  points = input<MapPoint3d[]>([]);
  height = input('min(66vh, 600px)');
  fillFor = input<(code: string) => string>(() => '#e3e8ef');
  subFor = input<(code: string) => string>(() => '');
  /** عدد مواقع المحافظة — يحدد ارتفاع قطعتها */
  badgeFor = input<(code: string) => number>(() => 0);

  governorateSelect = output<string>();
  pointSelect = output<number>();
  back = output<void>();
  ready = output<GovernorateFeature[]>();
  failed = output<void>();

  attribution = GOVERNORATES_ATTRIBUTION;
  protected names = signal<{ code: string; name: string }[]>([]);
  protected tip = signal<{ x: number; y: number; title: string; sub: string } | null>(null);
  protected loading = signal(true);

  private host = viewChild.required<ElementRef<HTMLElement>>('stage');
  private labelsEl = viewChild.required<ElementRef<HTMLElement>>('labels');
  private geo = inject(SyriaGeoService);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  private T?: Three;
  private scene?: SceneState;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
    // البيانات أو الثيم تغيّرت: ألوان وارتفاعات ودبابيس جديدة
    effect(() => { this.fillFor(); this.badgeFor(); this.points(); untracked(() => this.scene && this.refresh()); });
    effect(() => { const code = this.focus(); untracked(() => this.scene && this.applyFocus(code)); });
  }

  // ─────────── التحميل ───────────

  private async init() {
    try {
      const [T, { OrbitControls }, data] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        new Promise<GovernorateFeature[]>((resolve, reject) => this.geo.governorates().subscribe({ next: d => resolve(d.features), error: reject }))
      ]);
      this.T = T;
      this.scene = new SceneState(T, OrbitControls, this.host().nativeElement, this.labelsEl().nativeElement, data, {
        onGovernorate: code => this.zone.run(() => this.governorateSelect.emit(code)),
        onPoint: id => this.zone.run(() => this.pointSelect.emit(id)),
        onBack: () => this.zone.run(() => this.back.emit()),
        onTip: tip => this.zone.run(() => this.tip.set(tip)),
        subFor: code => this.subFor()(code),
        isFocused: () => !!this.focus(),
        onTheme: () => this.refresh()
      });
      this.refresh();
      this.scene.applyFocus(this.focus(), true);
      this.zone.run(() => {
        this.names.set(data.map(f => ({ code: f.properties.code, name: f.properties.nameAr })).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        this.loading.set(false);
        this.ready.emit(data);
      });
      this.destroyRef.onDestroy(() => this.scene?.dispose());
    } catch (e) {
      console.error('تعذّر تشغيل الخريطة ثلاثية الأبعاد', e);
      this.zone.run(() => this.failed.emit());
    }
  }

  private refresh() { this.scene?.update(this.fillFor(), this.badgeFor(), this.points()); }
  private applyFocus(code: string | null) { this.scene?.applyFocus(code); }

  protected jump(code: string) { if (code) this.governorateSelect.emit(code); }
  protected reset() { this.scene?.resetCamera(); }
  protected escape() { if (this.focus()) this.back.emit(); }
}

// ═══════════════════════ المشهد (خارج Angular) ═══════════════════════

interface Callbacks {
  onGovernorate(code: string): void;
  onPoint(id: number): void;
  onBack(): void;
  onTip(tip: { x: number; y: number; title: string; sub: string } | null): void;
  subFor(code: string): string;
  isFocused(): boolean;
  /** الثيم أو الوضع الداكن تغيّر: ألوان جديدة */
  onTheme(): void;
}

class SceneState {
  private renderer: import('three').WebGLRenderer;
  private world: import('three').Scene;
  private camera: import('three').PerspectiveCamera;
  private controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
  private map: import('three').Group;
  private ground: import('three').Mesh;
  private pieces: Piece[] = [];
  private pins: Pin[] = [];
  private labels = new Map<string, HTMLElement>();
  private pinLabels = new Map<Pin, HTMLElement>();
  private focus: Piece | null = null;
  private hovered: Piece | Pin | null = null;
  private labelHover: Piece | null = null;
  private iso = { k: 0, f: 1, z: 1, cx: 0, cy: 0 };
  private fly: { t0: number; ms: number; fromT: import('three').Vector3; toT: import('three').Vector3; fromP: import('three').Vector3; toP: import('three').Vector3 } | null = null;
  private activeUntil = 0;
  private running = false;
  private last = 0;
  private dark = false;
  private colors = new Map<string, import('three').Color>();
  private probe: HTMLElement;
  private paint = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
  private cleanup: (() => void)[] = [];
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private T: Three, OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
              private host: HTMLElement, private labelsEl: HTMLElement, features: GovernorateFeature[], private cb: Callbacks) {
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    host.prepend(this.renderer.domElement);

    this.world = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, 1, .5, 2000);
    this.camera.position.set(...HOME.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: .08, minDistance: 14, maxDistance: 190, enablePan: false,
      maxPolarAngle: Math.PI * .44, minPolarAngle: Math.PI * .08 });
    // الزر الأيمن للرجوع (لا للتحريك)
    this.controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: null as unknown as import('three').MOUSE };
    this.controls.target.set(...HOME.target);
    this.controls.addEventListener('change', () => this.wake());

    this.world.add(new T.HemisphereLight(0xffffff, 0x8a8f8c, 1.15));
    const sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-40, 90, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 });
    sun.shadow.bias = -.0008; sun.shadow.radius = 6;
    this.world.add(sun);
    this.ground = new T.Mesh(new T.PlaneGeometry(600, 600), new T.ShadowMaterial({ opacity: .16 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true;
    this.world.add(this.ground);

    this.map = new T.Group(); this.map.rotation.x = -Math.PI / 2;
    this.world.add(this.map);

    // ألوان CSS (متغيرات الثيم) تُحوَّل إلى ألوان المشهد عبر عنصر قياس
    this.probe = document.createElement('i');
    this.probe.style.display = 'none';
    host.appendChild(this.probe);

    this.buildPieces(features);
    this.listen();
    this.resize();
    this.wake(1600);
  }

  // ─────────── البناء ───────────

  private buildPieces(features: GovernorateFeature[]) {
    const T = this.T;
    for (const f of features) {
      const polygons: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]] : f.geometry.coordinates as Ring[][];
      const shapes = polygons.map(poly => {
        const shape = new T.Shape(poly[0].map(([x, y]) => new T.Vector2(...project(x, y))));
        poly.slice(1).forEach(h => shape.holes.push(new T.Path(h.map(([x, y]) => new T.Vector2(...project(x, y))))));
        return shape;
      });
      const center = project(f.properties.centerLng, f.properties.centerLat);
      // عمق 1 ثم يُضبط الارتفاع بـ scale.z (يتغير مع البيانات بلا إعادة بناء)
      const geom = new T.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      geom.translate(-center[0], -center[1], 0);
      const mesh = new T.Mesh(geom, [new T.MeshStandardMaterial({ roughness: .62, metalness: .05, transparent: true }),
                                     new T.MeshStandardMaterial({ roughness: .8, transparent: true })]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(center[0], center[1], 0);
      mesh.scale.set(.985, .985, 1);
      const edges = new T.LineSegments(new T.EdgesGeometry(geom, 35), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 }));
      mesh.add(edges);
      const piece: Piece = { code: f.properties.code, name: f.properties.nameAr, feature: f, center, depth: 1.4, lift: 0, mesh, edges };
      mesh.userData['piece'] = piece;
      this.map.add(mesh);
      this.pieces.push(piece);

      // اسم المحافظة: زر فوق المشهد (هدف كبير حتى للمحافظات الصغيرة)
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'gov-label'; el.textContent = piece.name;
      el.setAttribute('aria-label', 'محافظة ' + piece.name);
      el.addEventListener('mouseenter', e => { this.labelHover = piece; this.showGovTip(piece, e); this.wake(); });
      el.addEventListener('mousemove', e => this.showGovTip(piece, e));
      el.addEventListener('mouseleave', () => { this.labelHover = null; this.cb.onTip(null); this.wake(); });
      el.addEventListener('mousedown', e => e.preventDefault());   // بلا تركيز بالماوس: لا يقفز المتصفح إلى الزر
      el.addEventListener('click', () => this.cb.onGovernorate(piece.code));
      el.addEventListener('contextmenu', e => this.contextMenu(e));
      this.labelsEl.appendChild(el);
      this.labels.set(piece.code, el);
    }
  }

  /** ألوان القطع وارتفاعاتها والدبابيس من بيانات الأب */
  update(fillFor: (code: string) => string, badgeFor: (code: string) => number, points: MapPoint3d[]) {
    const T = this.T;
    this.dark = document.documentElement.dataset['mode'] === 'dark'
      || (!document.documentElement.dataset['mode'] && matchMedia('(prefers-color-scheme: dark)').matches);
    this.colors.clear();
    const max = Math.max(1, ...this.pieces.map(p => badgeFor(p.code)));
    for (const p of this.pieces) {
      const n = badgeFor(p.code);
      p.depth = 1.4 + (n / max) * 5 + (SMALL.has(p.code) ? 1.5 : 0);
      const top = this.color(fillFor(p.code));
      const [face, side] = p.mesh.material as import('three').MeshStandardMaterial[];
      face.color.copy(top);
      side.color.copy(top).multiplyScalar(this.dark ? .62 : .78);
      (p.edges.material as import('three').LineBasicMaterial).color.set(this.dark ? 0x9fd6ca : 0xffffff);
    }
    (this.ground.material as import('three').ShadowMaterial).opacity = this.dark ? .45 : .16;

    // الدبابيس: تُبنى من جديد مع البيانات
    for (const pin of this.pins) { this.map.remove(pin.group); pin.group.traverse(o => (o as import('three').Mesh).material && ((o as import('three').Mesh).material as import('three').Material).dispose()); }
    this.pinLabels.forEach(el => el.remove());
    this.pins = []; this.pinLabels.clear();
    const stem = new T.CylinderGeometry(.09, .09, 1, 10); stem.rotateX(Math.PI / 2); stem.translate(0, 0, .5);
    const head = new T.SphereGeometry(.55, 24, 16);
    const counts = new Map<string, number>();
    for (const point of points) {
      const piece = this.pieces.find(p => p.code === point.governorateCode);
      if (!piece) continue;
      const group = new T.Group();
      const [x, y] = project(point.longitude, point.latitude);
      const i = counts.get(piece.code) ?? 0; counts.set(piece.code, i + 1);
      const h = 2.4 + (i % 3) * .5;
      const stick = new T.Mesh(stem, new T.MeshStandardMaterial({ color: 0x8e8e93, roughness: .4 }));
      stick.scale.z = h; stick.castShadow = true;
      const color = this.color(point.colors?.[0] || 'var(--brand-600)');
      const ball = new T.Mesh(head, new T.MeshStandardMaterial({ color, roughness: .3, metalness: .1, emissive: color, emissiveIntensity: .1 }));
      ball.position.z = h; ball.castShadow = true;
      group.add(stick, ball);
      group.position.set(x, y, 0);
      const pin: Pin = { point, piece, group, head: ball, h, scale: 0 };
      ball.userData['pin'] = pin;
      this.map.add(group);
      this.pins.push(pin);
      const el = document.createElement('span');
      el.className = 'pin-label'; el.textContent = point.label;
      this.labelsEl.appendChild(el);
      this.pinLabels.set(pin, el);
    }
    this.wake(900);
  }

  private color(css: string): import('three').Color {
    let c = this.colors.get(css);
    if (!c) {
      // ألوان الثيم قد تكون color-mix: يرسمها المتصفح على لوحة صغيرة ونقرأ البكسل الناتج
      this.probe.style.color = css;
      const ctx = this.paint.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = getComputedStyle(this.probe).color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      c = new this.T.Color().setRGB(r / 255, g / 255, b / 255, this.T.SRGBColorSpace);
      this.colors.set(css, c);
    }
    return c;
  }

  // ─────────── التنقل ───────────

  applyFocus(code: string | null, instant = false) {
    const T = this.T;
    const piece = code ? this.pieces.find(p => p.code === code) ?? null : null;
    this.focus = piece;
    this.cb.onTip(null);
    if (piece) {
      [this.iso.cx, this.iso.cy] = piece.center;
      piece.mesh.geometry.computeBoundingBox();
      const b = piece.mesh.geometry.boundingBox!;
      this.iso.f = Math.min(22, Math.max(1, FIT / Math.max(b.max.x - b.min.x, b.max.y - b.min.y)));
      // الارتفاع يتناسب مع حجم العرض: المحافظة المعروضة منفصلة لا تبدو كتلة سميكة
      this.iso.z = Math.min(1, ISO_HEIGHT / piece.depth);
      this.flyTo(new T.Vector3(0, piece.depth * this.iso.z * .5, 0), new T.Vector3(4, 46, 42), instant);
    } else {
      this.flyTo(new T.Vector3(...HOME.target), new T.Vector3(...HOME.camera), instant);
    }
  }

  resetCamera() { this.applyFocus(this.focus?.code ?? null); }

  private flyTo(target: import('three').Vector3, pos: import('three').Vector3, instant: boolean) {
    if (instant || this.reduced) {
      this.controls.target.copy(target); this.camera.position.copy(pos);
      if (instant) this.iso.k = this.focus ? 1 : 0;
      this.fly = null;
    } else {
      this.fly = { t0: performance.now(), ms: 1100, fromT: this.controls.target.clone(), toT: target, fromP: this.camera.position.clone(), toP: pos };
    }
    this.wake(1600);
  }

  // ─────────── التفاعل ───────────

  private listen() {
    const canvas = this.renderer.domElement;
    const ray = new this.T.Raycaster(), mouse = new this.T.Vector2();
    let down: [number, number] | null = null;
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, this.camera);
      const heads = this.pins.filter(p => p.group.visible).map(p => p.head);
      const hit = ray.intersectObjects([...heads, ...this.pieces.filter(p => p.mesh.visible).map(p => p.mesh)], false)[0];
      const next = (hit?.object.userData['pin'] as Pin | undefined) ?? (hit?.object.userData['piece'] as Piece | undefined) ?? null;
      if (next !== this.hovered) { this.hovered = next; this.wake(); }
      canvas.style.cursor = next && next !== this.focus ? 'pointer' : 'grab';
      if (!next || next === this.focus) { this.cb.onTip(null); return; }
      if ('point' in next) this.cb.onTip({ ...this.local(e), title: next.point.label, sub: next.point.sub ?? '' });
      else this.showGovTip(next, e);
    };
    const leave = () => { this.hovered = null; this.cb.onTip(null); this.wake(); };
    const pdown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const pup = (e: PointerEvent) => {
      if (!down || e.button !== 0 || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const h = this.hovered;
      if (h && 'point' in h) this.cb.onPoint(h.point.id);
      else if (h && h !== this.focus) this.cb.onGovernorate(h.code);
    };
    const ctx = (e: MouseEvent) => this.contextMenu(e);
    const ro = new ResizeObserver(() => this.resize());
    const theme = new MutationObserver(() => this.cb.onTheme());
    const scheme = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const schemeChange = () => this.cb.onTheme();
    scheme?.addEventListener('change', schemeChange);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('pointerup', pup);
    canvas.addEventListener('contextmenu', ctx);
    canvas.addEventListener('wheel', () => this.wake(), { passive: true });
    ro.observe(this.host);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    this.cleanup.push(() => {
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerdown', pdown); canvas.removeEventListener('pointerup', pup);
      canvas.removeEventListener('contextmenu', ctx); ro.disconnect(); theme.disconnect(); scheme?.removeEventListener('change', schemeChange);
    });
  }

  /** الزر الأيمن: رجوع من المحافظة إلى سوريا (في عرض سوريا تبقى قائمة المتصفح المعتادة) */
  private contextMenu(e: MouseEvent) {
    if (!this.cb.isFocused()) return;
    e.preventDefault();
    this.cb.onBack();
  }

  private local(e: MouseEvent) { const r = this.host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private showGovTip(p: Piece, e: MouseEvent) { if (p !== this.focus) this.cb.onTip({ ...this.local(e), title: p.name, sub: this.cb.subFor(p.code) }); }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wake();
  }

  // ─────────── الرسم عند الحاجة ───────────

  /** يُبقي الرسم مستمراً حتى انتهاء الحركات، ثم يتوقف (لا استهلاك للمعالج والخريطة ساكنة) */
  private wake(ms = 700) {
    this.activeUntil = Math.max(this.activeUntil, performance.now() + ms);
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(now => this.frame(now));
  }

  private frame(now: number) {
    const dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
    const a = (r: number) => this.reduced ? 1 : 1 - Math.pow(1 - r, dt * 60);
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    if (this.fly) {
      const k = ease(Math.min(1, (now - this.fly.t0) / this.fly.ms));
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, k);
      this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, k);
      if (k >= 1) this.fly = null; else this.wake(100);
    }
    this.controls.update();

    // الانتقال بين سوريا والمحافظة المنفصلة
    this.iso.k += ((this.focus ? 1 : 0) - this.iso.k) * a(.085);
    const ek = this.iso.k < .001 ? 0 : this.iso.k > .999 ? 1 : this.iso.k;
    const ms = 1 + (this.iso.f - 1) * ek;
    const mz = 1 + (this.iso.z - 1) * ek;
    this.map.scale.set(ms, ms, mz);
    this.map.position.set(-this.iso.cx * ms * ek, 0, this.iso.cy * ms * ek);
    let moving = ek > 0 && ek < 1;

    for (const p of this.pieces) {
      const lift = (p === this.hovered || p === this.labelHover) && !this.focus ? 1.6 : 0;
      p.lift += (lift - p.lift) * a(.15);
      const mats = p.mesh.material as import('three').MeshStandardMaterial[];
      const fade = this.focus && p !== this.focus ? 0 : 1;
      for (const m of mats) m.opacity += (fade - m.opacity) * a(.14);
      const o = mats[0].opacity;
      (p.edges.material as import('three').LineBasicMaterial).opacity = (this.dark ? .35 : .5) * o;
      for (const m of mats) m.transparent = o < .99;
      p.mesh.scale.z = p.depth;
      p.mesh.position.z = p.lift / mz - (1 - o) * 6;
      p.mesh.visible = o > .02;
      if (Math.abs(lift - p.lift) > .01 || Math.abs(fade - o) > .01) moving = true;
    }

    for (const pin of this.pins) {
      const show = !this.focus || pin.piece === this.focus;
      pin.scale += ((show ? 1 : 0) - pin.scale) * a(.18);
      pin.group.visible = pin.scale > .02;
      const s = pin.scale * (pin === this.hovered ? 1.25 : 1);
      pin.group.scale.set(s / ms, s / ms, s / mz);   // تكبير الخريطة لا يمطّ الدبابيس
      pin.group.position.z = pin.piece.depth + .25 + pin.piece.lift / mz;
      if (Math.abs((show ? 1 : 0) - pin.scale) > .01) moving = true;
    }

    this.renderer.render(this.world, this.camera);
    this.placeLabels(ms, mz);

    if (moving) this.wake(100);
    if (now > this.activeUntil) { this.running = false; this.renderer.setAnimationLoop(null); }
  }

  private placeLabels(ms: number, mz: number) {
    const T = this.T, v = new T.Vector3();
    const { clientWidth: w, clientHeight: h } = this.host;
    const at = (x: number, y: number, z: number) => { v.set(x, y, z); this.map.localToWorld(v); v.project(this.camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 }; };
    for (const p of this.pieces) {
      const el = this.labels.get(p.code)!;
      const s = at(p.center[0], p.center[1], p.depth + p.lift / mz + 1.2 / mz);
      const o = (p.mesh.material as import('three').MeshStandardMaterial[])[0].opacity;
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      el.style.opacity = s.behind || this.focus ? '0' : String(o);
      el.style.visibility = this.focus || s.behind ? 'hidden' : 'visible';
    }
    for (const [pin, el] of this.pinLabels) {
      const s = at(pin.group.position.x, pin.group.position.y, pin.group.position.z + (pin.h + 1.1) / mz);
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      el.style.opacity = this.focus && pin.piece === this.focus && !s.behind ? String(pin.scale) : '0';
    }
    void ms;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.cleanup.forEach(fn => fn());
    this.controls.dispose();
    this.world.traverse(o => {
      const m = o as import('three').Mesh;
      m.geometry?.dispose();
      const mat = m.material as import('three').Material | import('three').Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.forEach(el => el.remove());
    this.pinLabels.forEach(el => el.remove());
    this.probe.remove();
  }
}
