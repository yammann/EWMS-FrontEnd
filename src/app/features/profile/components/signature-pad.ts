import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild, DestroyRef } from '@angular/core';
import { Modal } from '@shared/ui/modal';
import { InkPoint, InkStroke, cleanUpload, inkOnScreen, luminance, strokePath, strokesToPng, toRgb } from '../utils/signature-ink';

type Method = 'draw' | 'upload';

/** ألوان الحبر (قرار المستخدم 2026-10-05: أسود وأزرق) */
const INKS = [
  { name: 'أسود', value: '#171717' },
  { name: 'أزرق', value: '#1d4ed8' }
] as const;

const NIB = 6;
/** حد الخادم لصورة التوقيع (~300KB) */
const MAX_DATA_URL = 300_000;

/**
 * لوحة التوقيع في نافذة: «رسم» بحبر يتبع الضغط أو السرعة ويستدقّ طرفاه، أو «رفع صورة» يُزال بياض ورقها ويُقصّ.
 * تُخرج PNG شفافاً مقصوصاً على حدود التوقيع مع كلمة المرور (تأكيد التغيير يطلبه الخادم).
 */
@Component({
  selector: 'app-signature-pad', standalone: true, imports: [Modal],
  templateUrl: './signature-pad.html',
  styleUrl: './signature-pad.scss'
})
export class SignaturePad {
  busy = input(false);
  error = input('');
  /** الصورة (data URL) وكلمة المرور */
  accepted = output<{ image: string; password: string }>();
  closed = output<void>();

  inks = INKS;
  method = signal<Method>('draw');
  color = signal<string>(INKS[0].value);
  strokes = signal<InkStroke[]>([]);
  drawing = signal(false);
  image = signal<string | null>(null);
  reading = signal(false);
  over = signal(false);
  password = signal('');
  localError = signal('');

  ready = computed(() => this.method() === 'draw' ? this.strokes().length > 0 : !!this.image());

  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private live: InkStroke | null = null;
  private last: { x: number; y: number; t: number; p: number } | null = null;
  private dark = false;
  private resize = new ResizeObserver(() => this.fit());

  constructor() {
    afterNextRender(() => { this.readDark(); this.observe(); });
    inject(DestroyRef).onDestroy(() => this.resize.disconnect());
  }

  // ───────── التبويبات ─────────
  setMethod(m: Method) {
    if (this.method() === m) return;
    this.method.set(m); this.localError.set('');
    // اللوحة تُنشأ من جديد عند العودة إلى «رسم»: تُقاس وتُرسم خطوطها بعد ظهورها
    if (m === 'draw') setTimeout(() => this.observe());
  }

  tabKeys(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const list = (e.currentTarget as HTMLElement).parentElement;
    this.setMethod(this.method() === 'draw' ? 'upload' : 'draw');
    // التركيز ينتقل مع التبويب المختار (بعد تحديث العرض)
    setTimeout(() => list?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }

  // ───────── الرسم ─────────
  private observe() {
    const canvas = this.canvas()?.nativeElement;
    this.resize.disconnect();
    if (canvas) { this.resize.observe(canvas); this.fit(); }
  }

  /** السطح الداكن يُقرأ من لونه المرسوم فعلاً (يعمل مع كل الألوان والوضع الداكن) */
  private readDark() {
    const rgb = toRgb(getComputedStyle(this.surface().nativeElement).backgroundColor);
    this.dark = !!rgb && luminance(rgb) < 0.5;
  }

  /** اللوحة بدقة الشاشة الفعلية (حادة على الشاشات عالية الكثافة) */
  private fit() {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    this.readDark();
    this.paint();
  }

  private paint() {
    const canvas = this.canvas()?.nativeElement, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const s of this.live ? [...this.strokes(), this.live] : this.strokes()) {
      ctx.fillStyle = inkOnScreen(s.color, this.dark);
      ctx.fill(new Path2D(strokePath(s)));
    }
  }

  /** نقطة مع «ضغط»: القلم يعطي ضغطه الحقيقي، والفأرة يُقدَّر من السرعة (السريع أرق) بتليين يمنع البقع */
  private point(e: PointerEvent): InkPoint {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top, now = performance.now();
    let p: number;
    if (e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5) p = e.pressure;
    else if (this.last) {
      const speed = Math.hypot(x - this.last.x, y - this.last.y) / Math.max(1, now - this.last.t);
      const target = Math.max(0.28, Math.min(1, 1 - speed / 2.4));
      p = this.last.p + (target - this.last.p) * 0.45;
    } else p = 0.65;
    this.last = { x, y, t: now, p };
    return { x, y, p };
  }

  down(e: PointerEvent) {
    if (this.busy()) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.last = null;
    this.live = { points: [this.point(e)], color: this.color(), size: NIB };
    this.drawing.set(true);
    this.paint();
  }

  moveTo(e: PointerEvent) {
    if (!this.live) return;
    const pt = this.point(e), prev = this.live.points[this.live.points.length - 1];
    if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1.1) return;   // عينات لم تتحرك تقريباً: ارتعاش بلا شكل
    this.live.points.push(pt);
    this.paint();
  }

  end() {
    const live = this.live;
    this.live = null; this.last = null;
    this.drawing.set(false);
    if (live?.points.length) this.strokes.update(s => [...s, live]);
    this.paint();
  }

  undo() { this.strokes.update(s => s.slice(0, -1)); this.paint(); }
  clear() { this.strokes.set([]); this.paint(); }

  // ───────── الرفع ─────────
  picked(e: Event) {
    const input = e.target as HTMLInputElement;
    this.take(input.files?.[0]);
    input.value = '';
  }

  dropped(e: DragEvent) {
    e.preventDefault();
    this.over.set(false);
    this.take(e.dataTransfer?.files?.[0]);
  }

  private async take(file?: File | null) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { this.localError.set('الصورة PNG أو JPG فقط'); return; }
    this.reading.set(true); this.localError.set('');
    try { this.image.set(await cleanUpload(file)); }
    catch (err) { this.localError.set(err instanceof Error ? err.message : 'تعذّرت قراءة الصورة'); }
    finally { this.reading.set(false); }
  }

  // ───────── الاعتماد ─────────
  accept() {
    if (!this.ready() || !this.password() || this.busy()) return;
    const image = this.method() === 'draw' ? strokesToPng(this.strokes()) : this.image();
    if (!image) return;
    if (image.length > MAX_DATA_URL) { this.localError.set('صورة التوقيع كبيرة جداً — جرّب صورة أصغر'); return; }
    this.localError.set('');
    this.accepted.emit({ image, password: this.password() });
  }
}
