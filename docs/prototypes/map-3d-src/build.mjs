// يبني docs/prototypes/map-3d.html: ملف واحد يعمل بالضغط المزدوج بلا إنترنت ولا خادم
// (Three.js + المشهد + الحدود + الطوابع + أنماط الواجهة والخط مضمّنة).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const UI = 'F:/-EWMS-UI-main-main';
const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
const require = createRequire(UI + '/package.json');
const esbuild = require('esbuild');

// 1) المشهد من كود المكوّن نفسه (بلا Angular)
const src = fs.readFileSync(UI + '/src/app/features/map/components/syria-3d-map.ts', 'utf8').replace(/\r\n/g, '\n');
const head = src.slice(src.indexOf('type Three = '), src.indexOf('@Component('));
const tail = src.slice(src.indexOf('// ═══════════════════════ المشهد'));
let scene = `// منسوخ آلياً من src/app/features/map/components/syria-3d-map.ts (2026-10-14)
type Ring = [number, number][];
export interface GovernorateFeature { type: 'Feature'; properties: { code: string; nameAr: string; nameEn: string; centerLat: number; centerLng: number };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } }
export interface MapPoint { id: number; latitude: number; longitude: number; label: string; sub?: string; selected?: boolean; colors?: string[] }
` + head.replace('type Ring = [number, number][];\n', '') + tail.replace('class SceneState {', 'export class SceneState {');
fs.writeFileSync(path.join(here, 'scene.ts'), scene);

// 2) الحزمة
const out = await esbuild.build({
  entryPoints: [path.join(here, 'main.ts')], bundle: true, write: false, format: 'iife', minify: true,
  target: 'es2022', nodePaths: [UI + '/node_modules'], legalComments: 'none'
});
const js = out.outputFiles[0].text;

// 3) الأصول
const geo = fs.readFileSync(UI + '/public/maps/syria-governorates.geojson', 'utf8').trim();
const stamps = { plain: {}, framed: {} };
for (const v of ['plain', 'framed'])
  for (const f of fs.readdirSync(`${UI}/public/stamps/${v}`)) stamps[v][f.replace('.svg', '')] = fs.readFileSync(`${UI}/public/stamps/${v}/${f}`, 'utf8').trim();
const cssFile = fs.readdirSync(UI + '/dist/EWMS.Client/browser').find(f => /^styles-.*\.css$/.test(f));
let appCss = fs.readFileSync(`${UI}/dist/EWMS.Client/browser/${cssFile}`, 'utf8');
for (const w of ['light', 'regular', 'bold']) {
  const b64 = fs.readFileSync(`${UI}/public/fonts/qomra-arabic-${w}.woff2`).toString('base64');
  appCss = appCss.replaceAll(`url(/fonts/qomra-arabic-${w}.woff2)`, `url(data:font/woff2;base64,${b64})`)
                 .replace(new RegExp(`,\\s*url\\(/fonts/qomra-arabic-${w}\\.otf\\)\\s*format\\(["']?opentype["']?\\)`, 'g'), '');
}
const pageCss = fs.readFileSync(path.join(here, 'page.css'), 'utf8');
const tpl = fs.readFileSync(path.join(here, 'page.html'), 'utf8');

const html = tpl
  .replace('/*APP_CSS*/', () => appCss)
  .replace('/*PAGE_CSS*/', () => pageCss)
  .replace('/*DATA*/', () => `var GEO=${geo};var STAMPS=${JSON.stringify(stamps)};`)
  .replace('/*APP_JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
const target = UI + '/docs/prototypes/map-3d.html';
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, html);
console.log('written', target, (html.length / 1024).toFixed(0) + ' KB', '(js ' + (js.length / 1024).toFixed(0) + ' KB)');
