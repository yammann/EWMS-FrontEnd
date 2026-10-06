/**
 * هندسة حبر التوقيع: الخط ليس خطاً بعرض واحد بل مساحة مملوءة يتبع نصف قطرها ضغط القلم
 * (أو سرعة اليد مع الفأرة: البطء أثخن والسرعة أرق)، ويستدقّ طرفاه فيبدو خط يد.
 * نفس المسار (نص SVG) يُرسم على اللوحة ويُصدَّر إلى الصورة، فلا يختلف المحفوظ عن المرئي.
 */

export interface InkPoint { x: number; y: number; /** 0..1 */ p: number; }
export interface InkStroke { points: InkPoint[]; color: string; size: number; }

const num = (n: number) => Math.round(n * 100) / 100;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** متوسط متحرك لثلاث نقاط: يزيل تدرّج الفأرة */
function smooth(points: InkPoint[]): InkPoint[] {
  if (points.length < 3) return points;
  const out: InkPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    out.push({ x: (a.x + b.x * 2 + c.x) / 4, y: (a.y + b.y * 2 + c.y) / 4, p: (a.p + b.p * 2 + c.p) / 4 });
  }
  out.push(points[points.length - 1]);
  return out;
}

/** جانب من حدود الخط عبر نقاط المنتصف (وصلات ناعمة) */
function side(points: [number, number][], continued = false): string {
  const [first, ...rest] = points;
  let d = `${continued ? 'L' : 'M'} ${num(first[0])} ${num(first[1])}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const [x, y] = rest[i], [nx, ny] = rest[i + 1];
    d += ` Q ${num(x)} ${num(y)} ${num((x + nx) / 2)} ${num((y + ny) / 2)}`;
  }
  const last = rest[rest.length - 1];
  if (last) d += ` L ${num(last[0])} ${num(last[1])}`;
  return d;
}

/** حدود الخط كمسار SVG مغلق يُملأ */
export function strokePath(stroke: InkStroke): string {
  const pts = smooth(stroke.points);
  const base = stroke.size / 2;

  if (pts.length === 1) {
    const { x, y, p } = pts[0];
    const r = num(base * (0.4 + 0.6 * p));
    return `M ${num(x - r)} ${num(y)} a ${r} ${r} 0 1 0 ${num(r * 2)} 0 a ${r} ${r} 0 1 0 ${num(-r * 2)} 0 Z`;
  }

  const len: number[] = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = len[len.length - 1];
  // الاستدقاق على بضعة أضعاف عرض الريشة، ولا يتجاوز نصف الخط (وإلا اختفت الخطوط القصيرة)
  const taper = Math.min(stroke.size * 3.5, total / 2);

  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next.x - prev.x, dy = next.y - prev.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const fromStart = taper > 0 ? Math.min(1, len[i] / taper) : 1;
    const fromEnd = taper > 0 ? Math.min(1, (total - len[i]) / taper) : 1;
    const r = base * (0.32 + 0.68 * pts[i].p) * easeOut(Math.min(fromStart, fromEnd));
    left.push([pts[i].x - dy * r, pts[i].y + dx * r]);
    right.push([pts[i].x + dy * r, pts[i].y - dx * r]);
  }
  return `${side(left)} ${side(right.reverse(), true)} Z`;
}

/** حدود الحبر مع هامش — لقصّ الصورة المصدَّرة */
function bounds(strokes: InkStroke[], pad = 10) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    const r = s.size / 2;
    for (const pt of s.points) {
      x0 = Math.min(x0, pt.x - r); y0 = Math.min(y0, pt.y - r);
      x1 = Math.max(x1, pt.x + r); y1 = Math.max(y1, pt.y + r);
    }
  }
  return isFinite(x0) ? { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 } : null;
}

/** أقصى أبعاد الصورة المحفوظة (يبقيها صغيرة تحت حد الخادم ~300KB) */
export const MAX_EXPORT = { w: 1000, h: 360 };

/** صورة PNG شفافة مقصوصة على حدود التوقيع، بدقة مضاعفة ضمن الحد الأقصى */
export function strokesToPng(strokes: InkStroke[]): string | null {
  const b = bounds(strokes);
  if (!b) return null;
  const scale = Math.min(2, MAX_EXPORT.w / b.w, MAX_EXPORT.h / b.h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(b.w * scale));
  canvas.height = Math.max(1, Math.ceil(b.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.translate(-b.x, -b.y);
  for (const s of strokes) { ctx.fillStyle = s.color; ctx.fill(new Path2D(strokePath(s))); }
  return canvas.toDataURL('image/png');
}

/** أي لون CSS إلى rgb (يحلّله الـ canvas نفسه — يشمل oklch و color-mix) */
export function toRgb(css: string): [number, number, number] | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export const luminance = ([r, g, b]: [number, number, number]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** الحبر نفسه مُفتَّحاً ليُقرأ على سطح داكن (العرض فقط — المحفوظ بلونه الحقيقي) */
export function inkOnScreen(color: string, dark: boolean): string {
  if (!dark) return color;
  const rgb = toRgb(color);
  if (!rgb || luminance(rgb) > 0.5) return color;
  const mix = (v: number) => Math.round(v + (255 - v) * 0.72);
  return `rgb(${mix(rgb[0])} ${mix(rgb[1])} ${mix(rgb[2])})`;
}

/**
 * صورة توقيع مرفوعة: يُزال بياض الورق (يصير شفافاً بتدرّج يحفظ حواف الحبر) ويُقصّ الفراغ حولها،
 * فتُطبع صورة توقيع على ورقة دون مربع أبيض. تُصغَّر ضمن الحد الأقصى للحفظ.
 */
export async function cleanUpload(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
      el.src = url;
    });

    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h), px = data.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const alpha = Math.max(0, Math.min(255, (245 - lum) * 1.9));
        px[i + 3] = Math.min(px[i + 3], alpha);
        if (alpha > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
    }
    ctx.putImageData(data, 0, 0);
    if (x1 < 0) throw new Error('لم يُعثر على توقيع في الصورة — جرّب صورة أوضح على ورقة بيضاء');

    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const fit = Math.min(1, MAX_EXPORT.w / cw, MAX_EXPORT.h / ch);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw * fit)); out.height = Math.max(1, Math.round(ch * fit));
    out.getContext('2d')!.drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
