// تحويل طوابع المحافظات (ملفات الهوية البصرية) إلى ملفات تتلوّن بالثيم
// الاستخدام:  node scripts/prepare-stamps.mjs "<مجلد SVG من الهوية>"
//   المجلد يحتوي "مع اطار" و"بدون اطار"، وأسماء الملفات تتضمن اسم المحافظة (مثل "قلعة حلب.svg").
// الناتج: public/stamps/{framed|plain}/{SYxx}.svg (رمز المحافظة كما في public/maps/syria-governorates.geojson)
//  - الحبر (#04018c) → currentColor، والورق (#fff) → var(--stamp-paper, #fff)
//  - أسماء الـ classes تُسبق باسم فريد لكل ملف (الطوابع تُدرج inline في نفس الصفحة)
//  - الـ viewBox يُقص على حدود الرسم (القياسات أدناه من getBBox في المتصفح)
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node scripts/prepare-stamps.mjs "<SVG folder>"'); process.exit(1); }
const OUT = 'public/stamps';

const GOV = [
  ['ريف دمشق', 'SY03'], ['دمشق', 'SY01'], ['الدمشقي', 'SY01'], ['طرطوس', 'SY10'], ['دير الزور', 'SY09'],
  ['درعا', 'SY12'], ['الرقة', 'SY11'], ['القنيطرة', 'SY14'], ['ادلب', 'SY07'], ['حمص', 'SY04'],
  ['الحسكة', 'SY08'], ['حلب', 'SY02'], ['السويداء', 'SY13'], ['اللاذقية', 'SY06'], ['حماة', 'SY05']
];
const codeOf = name => GOV.find(([ar]) => name.includes(ar))?.[1];

// الطابع المؤطَّر: إطار موحّد في كل الملفات
const FRAMED_VIEWBOX = '140 110 316 440';
// غير المؤطَّر: حدود رسم كل معلم (x y w h) + هامش 8
const PLAIN_BOUNDS = {
  SY01: '182.2 189.5 233 250.7', SY02: '175.9 232 243.6 208', SY03: '173.5 209.6 248.3 241.5', SY04: '181.1 197.6 233 245.2',
  SY05: '178.7 214.6 241.3 227.7', SY06: '181.4 222.8 233 202.7', SY07: '182.2 220.6 233 195.3', SY08: '167.1 277.1 261.1 173.1',
  SY09: '159 210.1 289 259.1', SY10: '168.4 235.4 258.7 202.9', SY11: '179.6 245 236.1 191.5', SY12: '180.5 192.6 234.3 248.5',
  SY13: '173.7 242.9 247.9 200.4', SY14: '179.4 200 238.6 244.1'
};
const padded = (box, p) => box.split(' ').map(Number).map((n, i) => +(i < 2 ? n - p : n + 2 * p).toFixed(1)).join(' ');

const variants = { 'مع اطار': 'framed', 'بدون اطار': 'plain' };
const seen = {};

for (const [folder, variant] of Object.entries(variants)) {
  fs.mkdirSync(path.join(OUT, variant), { recursive: true });
  for (const file of fs.readdirSync(path.join(SRC, folder)).filter(f => f.endsWith('.svg'))) {
    const code = codeOf(file.replace('.svg', ''));
    if (!code) throw new Error('no governorate for ' + file);
    if (seen[variant + code]) throw new Error(`duplicate ${variant}/${code}: ${seen[variant + code]} / ${file}`);
    seen[variant + code] = file;

    const prefix = `s-${code.toLowerCase()}-${variant[0]}`;
    const viewBox = variant === 'framed' ? FRAMED_VIEWBOX : padded(PLAIN_BOUNDS[code], 8);

    const svg = fs.readFileSync(path.join(SRC, folder, file), 'utf8')
      .replace(/<\?xml[^>]*>\s*/, '')
      .replace(/<!--[\s\S]*?-->\s*/g, '')
      .replace(/\s(id|data-name)="[^"]*"/g, '')
      .replace(/#04018c/gi, 'currentColor')
      .replace(/fill:\s*#fff(fff)?\b/gi, 'fill: var(--stamp-paper, #fff)')
      .replace(/\.st(\d+)/g, `.${prefix}-$1`)
      .replace(/class="([^"]+)"/g, (_, cls) => `class="${cls.split(/\s+/).map(c => c.replace(/^st(\d+)$/, `${prefix}-$1`)).join(' ')}"`)
      // طابع درعا: كلمة SYRIA نص حيّ بخط غير متوفر (باقي الطوابع محوّلة لمسارات) — خط serif بديل
      .replace(/font-family:\s*thmanyahseriftext-Bold,\s*'thmanyah serif text';/, "font-family: 'Times New Roman', Georgia, serif;")
      .replace(/<svg\b([^>]*)>/, (m, attrs) =>
        `<svg${attrs.replace(/\sversion="[^"]*"/, '').replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)} focusable="false" aria-hidden="true">`)
      .replace(/\n\s*\n/g, '\n')
      .trim() + '\n';

    if (/#[0-9a-f]{3,6}\b/i.test(svg.replace(/var\(--stamp-paper, #fff\)/g, ''))) throw new Error('unexpected color in ' + file);
    fs.writeFileSync(path.join(OUT, variant, code + '.svg'), svg);
  }
}

const missing = Object.keys(PLAIN_BOUNDS).flatMap(c => ['framed', 'plain'].filter(v => !seen[v + c]).map(v => `${v}/${c}`));
console.log(`${Object.keys(seen).length} stamps written`, missing.length ? `— MISSING: ${missing.join(', ')}` : '(14 × 2)');
