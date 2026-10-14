// صفحة مستقلة تحفظ «خريطة الفروع ثلاثية الأبعاد» كما وصلت إليه في 2026-10-14 قبل العودة للخريطة المسطحة.
// المشهد نفسه منسوخ من src/app/features/map/components/syria-3d-map.ts (SceneState)؛ هنا فقط ما كان يقدّمه Angular:
// رأس الخريطة (التدوير، إعادة الضبط، مفاتيح الطبقات)، التلميح بطابع المحافظة، بطاقة طابع المحافظة المفتوحة، والخلفية.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GovernorateFeature, MapPoint3d, SceneState, webglAvailable } from './scene';

declare const GEO: { features: GovernorateFeature[] };
declare const STAMPS: { plain: Record<string, string>; framed: Record<string, string> };

const LANDMARKS: Record<string, string> = {
  SY01: 'السيف الدمشقي', SY02: 'قلعة حلب', SY03: 'غوطة ريف دمشق', SY04: 'ساعة حمص', SY05: 'نواعير حماة', SY06: 'قوس النصر',
  SY07: 'رويحة', SY08: 'عين ديوار', SY09: 'الجسر المعلق', SY10: 'جزيرة أرواد', SY11: 'بوابة بغداد', SY12: 'المسجد العمري',
  SY13: 'قنوات', SY14: 'بيت صيدا'
};

// ── بيانات تجريبية: طبقتان (تركيبات الأجهزة + طبقة يدوية) ──
interface Layer { key: string; title: string; unit: string; color: string; sites: [string, number, number, number][] }
const LAYERS: Layer[] = [
  { key: 'devices', title: 'التركيبات', unit: 'تركيب', color: 'var(--brand-600)', sites: [
    ['مستودع دمشق', 33.51, 36.29, 12], ['مقسم المزة', 33.50, 36.25, 4], ['محطة دوما', 33.57, 36.40, 7], ['مركز حلب', 36.20, 37.15, 20],
    ['مقسم حمص', 34.73, 36.71, 9], ['محطة تدمر', 34.56, 38.28, 3], ['محطة حماة', 35.13, 36.75, 3], ['مرفأ اللاذقية', 35.52, 35.79, 6],
    ['طرطوس', 34.89, 35.89, 2], ['دير الزور', 35.33, 40.14, 5], ['درعا', 32.62, 36.10, 1], ['الرقة', 35.95, 39.01, 4], ['القامشلي', 37.05, 41.22, 2]] },
  { key: 'projects', title: 'المشاريع', unit: 'سجل', color: '#988561', sites: [
    ['مشروع النبك', 34.02, 36.73, 3], ['مشروع السلمية', 35.01, 37.05, 2], ['مشروع إدلب', 35.93, 36.63, 4], ['مشروع السويداء', 32.71, 36.57, 1]] }
];

const inRing = (pt: [number, number], ring: number[][]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const polygons = (f: GovernorateFeature) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
const governorateOf = (lng: number, lat: number) => GEO.features.find(f => polygons(f).some(p => inRing([lng, lat], p[0])))?.properties.code ?? '';

let id = 0;
const ALL = LAYERS.flatMap(l => l.sites.map(([name, lat, lng, count]) => ({ id: ++id, name, lat, lng, count, layer: l, gov: governorateOf(lng, lat) })));
const hidden = new Set<string>();
const visible = () => ALL.filter(s => !hidden.has(s.layer.key) && s.gov);
const RAMP = ['var(--map-1)', 'var(--map-2)', 'var(--map-3)', 'var(--map-4)'];

function stats() {
  const by = new Map<string, typeof ALL>();
  for (const s of visible()) by.set(s.gov, [...(by.get(s.gov) ?? []), s]);
  return by;
}
const fillFor = () => {
  const by = stats(); const max = Math.max(0, ...[...by.values()].map(l => l.length));
  return (code: string) => { const n = by.get(code)?.length ?? 0; return n && max ? RAMP[Math.min(3, Math.ceil((n / max) * 4) - 1)] : 'var(--map-empty)'; };
};
const badgeFor = () => { const by = stats(); return (code: string) => by.get(code)?.length ?? 0; };
const subFor = (code: string) => {
  const list = stats().get(code);
  if (!list) return 'لا توجد مواقع';
  const per = LAYERS.map(l => [l.title, list.filter(s => s.layer === l).reduce((a, s) => a + s.count, 0)] as const).filter(([, n]) => n);
  return [`${list.length} موقع`, ...per.map(([t, n]) => `${t} ${n}`)].join(' · ');
};
const points = (): MapPoint3d[] => visible().map(s => ({
  id: s.id, latitude: s.lat, longitude: s.lng, label: s.name, governorateCode: s.gov,
  sub: `${s.layer.title} (${s.count} ${s.layer.unit})`, colors: [s.layer.color]
}));

// ── الصفحة ──
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const stage = $('#stage'), labels = $('#labels'), tipEl = $('#tip'), focusStamp = $('#focus-stamp'), title = $('#title'), hint = $('#zoom-hint');
const names = new Map(GEO.features.map(f => [f.properties.code, f.properties.nameAr]));
let focus: string | null = null;

// الخلفية: طوابع المعالم تطفو عند الأطراف
const FLOAT = [
  { code: 'SY02', x: '4%', y: '8%', r: '-9deg', w: '108px', d: '17s' }, { code: 'SY06', x: '84%', y: '6%', r: '7deg', w: '96px', d: '21s' },
  { code: 'SY04', x: '90%', y: '52%', r: '-5deg', w: '104px', d: '19s' }, { code: 'SY13', x: '3%', y: '62%', r: '6deg', w: '100px', d: '23s' },
  { code: 'SY09', x: '72%', y: '80%', r: '-4deg', w: '88px', d: '18s' }, { code: 'SY01', x: '18%', y: '84%', r: '5deg', w: '84px', d: '20s' }
];
$('#floats').innerHTML = FLOAT.map(s => `<span class="float" style="--x:${s.x};--y:${s.y};--r:${s.r};--w:${s.w};--d:${s.d}">${STAMPS.plain[s.code] ?? ''}</span>`).join('');
// خطوط كنتورية متموّجة
const contour = (r: number, seed: number) => {
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const w = 1 + .07 * Math.sin(a * 3 + seed) + .045 * Math.sin(a * 5 - seed * 1.7) + .03 * Math.sin(a * 9 + seed * .6);
    d += (i ? 'L' : 'M') + (500 + Math.cos(a) * r * 1.45 * w).toFixed(1) + ',' + (330 + Math.sin(a) * r * w).toFixed(1);
  }
  return d + 'Z';
};
$('#spin').innerHTML = [70, 120, 170, 225, 285, 350, 420].map((r, i) => `<path d="${contour(r, i * 1.3 + .4)}" stroke-width="${i % 3 ? .9 : 1.4}"/>`).join('');

// مفاتيح الطبقات (بعد زرّي التحكم)
const keys = $('#keys');
function renderKeys() {
  keys.innerHTML = LAYERS.map(l => `<button type="button" class="layer-key${hidden.has(l.key) ? ' off' : ''}" data-key="${l.key}" aria-pressed="${!hidden.has(l.key)}"><i style="background:${l.color}"></i>${l.title} <b>${l.sites.length}</b></button>`).join('');
  keys.querySelectorAll<HTMLButtonElement>('.layer-key').forEach(b => b.onclick = () => {
    hidden.has(b.dataset['key']!) ? hidden.delete(b.dataset['key']!) : hidden.add(b.dataset['key']!);
    renderKeys(); refresh();
  });
}

function setFocus(code: string | null) {
  focus = code;
  scene?.applyFocus(code);
  title.textContent = (code ? 'محافظة ' + names.get(code) : 'خريطة الفروع') + ' — الفرع التقني';
  $('#floats').classList.toggle('away', !!code);
  focusStamp.hidden = !code;
  if (code) {
    focusStamp.innerHTML = `<span class="stamp">${STAMPS.framed[code] ?? ''}</span><figcaption>${LANDMARKS[code] ?? ''}</figcaption>`;
    focusStamp.style.animation = 'none'; void focusStamp.offsetWidth; focusStamp.style.animation = '';
  }
}

let hintTimer = 0;
let scene: SceneState | null = null;
function refresh() { scene?.update(fillFor(), badgeFor(), points()); }

if (!webglAvailable()) {
  $('#fallback').hidden = false;
} else {
  scene = new SceneState(THREE, OrbitControls, stage, labels, GEO.features, {
    onGovernorate: code => setFocus(code),
    onPoint: () => toast('في النظام: يفتح صفحة الموقع'),
    onBack: () => setFocus(null),
    onTip: t => {
      if (!t) { tipEl.hidden = true; return; }
      tipEl.hidden = false;
      tipEl.className = 'tip' + (t.code ? ' with-stamp' : '');
      tipEl.style.left = t.x + 'px'; tipEl.style.top = t.y + 'px';
      tipEl.innerHTML = (t.code ? `<span class="tip-stamp">${STAMPS.plain[t.code] ?? ''}</span>` : '') + `<span class="tip-text"><strong>${t.title}</strong>${t.sub ? `<span>${t.sub}</span>` : ''}</span>`;
    },
    subFor,
    isFocused: () => !!focus,
    onTheme: () => refresh(),
    onZoomHint: () => { hint.classList.add('show'); clearTimeout(hintTimer); hintTimer = window.setTimeout(() => hint.classList.remove('show'), 1400); }
  });
  refresh();
  scene.applyFocus(null, true);
}
addEventListener('keydown', e => { if (e.key === 'Escape' && focus) setFocus(null); });

const spin = $('#tool-spin');
let spinning = false;
spin.onclick = () => {
  spinning = !spinning;
  scene?.setAutoRotate(spinning);
  spin.classList.toggle('on', spinning);
  spin.setAttribute('aria-pressed', String(spinning));
  spin.querySelector('span')!.textContent = spinning ? 'إيقاف التدوير' : 'تدوير تلقائي';
};
$('#tool-reset').onclick = () => scene?.resetCamera();

// المظهر: الثيمات الأربع والوضع الداكن (كما في النظام)
document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(b => b.onclick = () => document.documentElement.setAttribute('data-theme', b.dataset['palette']!));
$('#mode').onclick = () => {
  const dark = document.documentElement.getAttribute('data-mode') !== 'dark';
  document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
  $('#mode').textContent = dark ? 'الوضع الفاتح' : 'الوضع الداكن';
};

function toast(text: string) {
  const t = $('#toast');
  t.textContent = text; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}
renderKeys();
