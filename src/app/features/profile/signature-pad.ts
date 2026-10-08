import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild, DestroyRef } from '@angular/core';
import { Modal } from '@shared/ui/modal';
import { InkPoint, InkStroke, cleanUpload, inkOnScreen, luminance, strokePath, strokesToPng, toRgb } from './signature-ink';

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
  template: `
    <app-modal heading="توقيعي الإلكتروني" subheading="ارسم توقيعك أو ارفع صورته" [busy]="busy()" (closed)="cancel.emit()">
      <div class="modal-body sig">
        @if (error() || localError()) { <p class="alert alert-error" role="alert">{{ error() || localError() }}</p> }

        <div class="tabs" role="tablist" aria-label="طريقة التوقيع" [class.second]="method() === 'upload'">
          <span class="pill" aria-hidden="true"></span>
          <button type="button" role="tab" [attr.aria-selected]="method() === 'draw'" [attr.tabindex]="method() === 'draw' ? 0 : -1" autofocus
                  (click)="setMethod('draw')" (keydown)="tabKeys($event)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>رسم</button>
          <button type="button" role="tab" [attr.aria-selected]="method() === 'upload'" [attr.tabindex]="method() === 'upload' ? 0 : -1"
                  (click)="setMethod('upload')" (keydown)="tabKeys($event)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/></svg>رفع صورة</button>
        </div>

        <div class="toolbar">
          @if (method() === 'draw') {
            <div class="tools">
              <button type="button" class="ghost-btn" (click)="undo()" [disabled]="!strokes().length || busy()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>تراجع</button>
              <button type="button" class="ghost-btn" (click)="clear()" [disabled]="!strokes().length || busy()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 21-4-4L14 6l7 7-8 8Z"/><path d="M22 21H7"/></svg>مسح</button>
            </div>
            <div class="inks" role="radiogroup" aria-label="لون الحبر">
              @for (ink of inks; track ink.value) {
                <button type="button" role="radio" [attr.aria-checked]="color() === ink.value" [attr.aria-label]="ink.name" [title]="ink.name"
                        [class.on]="color() === ink.value" (click)="color.set(ink.value)"><span [style.background]="ink.value"></span></button>
              }
            </div>
          } @else {
            <span class="hint">صورة أو مسح ضوئي لتوقيعك على ورقة بيضاء</span>
          }
        </div>

        <div class="surface" #surface>
          @if (method() === 'draw') {
            <canvas #canvas role="img" aria-label="مساحة رسم التوقيع"
                    (pointerdown)="down($event)" (pointermove)="moveTo($event)" (pointerup)="end()" (pointercancel)="end()"></canvas>
            <div class="rule" aria-hidden="true">
              <div class="line"></div>
              <p class="rule-hint" [class.hidden]="strokes().length || drawing()">وقّع فوق الخط</p>
            </div>
          } @else if (image(); as img) {
            <div class="preview">
              <img [src]="img" alt="التوقيع المرفوع">
              <div class="tools">
                <button type="button" class="ghost-btn" (click)="file.click()" [disabled]="busy()">استبدال</button>
                <button type="button" class="ghost-btn" (click)="image.set(null)" [disabled]="busy()">إزالة</button>
              </div>
            </div>
          } @else {
            <button type="button" class="drop" [class.over]="over()" (click)="file.click()"
                    (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="dropped($event)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/></svg>
              <strong>{{ reading() ? 'جارٍ قراءة الصورة…' : 'اسحب الصورة إلى هنا أو اخترها' }}</strong>
              <small>PNG أو JPG — يُزال بياض الورق تلقائياً</small>
            </button>
          }
          <input #file type="file" accept="image/png,image/jpeg" hidden (change)="picked($event)">
        </div>

        <p class="consent">بتوقيعي إلكترونياً أُقرّ بأن هذا التوقيع يُعتمد على الأوراق التي أوقّعها في النظام، وأن تغييره لاحقاً لا يغيّر ما وقّعته سابقاً.</p>

        <label class="form-field password"><span class="form-label">كلمة المرور (لتأكيد اعتماد التوقيع)</span>
          <input type="password" autocomplete="current-password" [value]="password()" (input)="password.set($any($event.target).value)"
                 (keydown.enter)="accept()"></label>
      </div>
      <footer class="modal-actions">
        <button type="button" class="ghost" (click)="cancel.emit()" [disabled]="busy()">إلغاء</button>
        <button type="button" (click)="accept()" [disabled]="!ready() || !password() || busy()">
          {{ busy() ? 'جارٍ الحفظ…' : '✓ اعتماد التوقيع' }}</button>
      </footer>
    </app-modal>`,
  styles: [`
    .sig { display: grid; gap: 12px; }
    svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex: none; }

    /* التبويبان: مؤشر ينزلق بينهما */
    .tabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: var(--fill); }
    .pill { position: absolute; top: 4px; bottom: 4px; inset-inline-start: 4px; width: calc(50% - 6px); border-radius: 9px;
      background: var(--surface-raised, var(--surface)); box-shadow: 0 1px 2px rgb(0 0 0 / .14), 0 0 0 1px rgb(0 0 0 / .06);
      transition: inset-inline-start .28s cubic-bezier(.3, 1.3, .5, 1); }
    .tabs.second .pill { inset-inline-start: calc(50% + 2px); }
    .tabs button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 8px;
      border: 0; border-radius: 9px; background: transparent; color: var(--ink-500); font-weight: 500; font-size: 13px; box-shadow: none; }
    .tabs button[aria-selected="true"] { color: var(--ink-900); font-weight: 700; }
    .tabs button:hover { transform: none; box-shadow: none; color: var(--ink-900); }

    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
    .tools { display: flex; align-items: center; gap: 2px; }
    .ghost-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 0; border-radius: 9px;
      background: transparent; color: var(--ink-600); font-size: 13px; font-weight: 500; box-shadow: none; }
    .ghost-btn:hover:not(:disabled) { background: var(--fill); color: var(--ink-900); transform: none; box-shadow: none; }
    .ghost-btn:disabled { opacity: .4; }
    .hint { font-size: 13px; color: var(--ink-400); }

    .inks { display: flex; gap: 6px; }
    .inks button { display: grid; place-items: center; width: 28px; height: 28px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; }
    .inks span { width: 18px; height: 18px; border-radius: 50%; transition: box-shadow .15s, transform .15s; }
    .inks button:hover span { transform: scale(1.1); }
    .inks button.on span { box-shadow: 0 0 0 2px var(--surface-raised, var(--surface)), 0 0 0 4px var(--border-strong); }

    /* سطح التوقيع */
    .surface { position: relative; height: 196px; border-radius: 14px; background: var(--fill); overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
    .rule { position: absolute; inset-inline: 32px; bottom: 52px; pointer-events: none; user-select: none; }
    .line { height: 1px; background: var(--border-strong); }
    .rule-hint { margin: 8px 0 0; text-align: center; font-size: 12.5px; color: var(--ink-400); transition: opacity .2s; }
    .rule-hint.hidden { opacity: 0; }

    .drop { position: absolute; inset: 20px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      border: 1px dashed var(--border-strong); border-radius: 14px; background: transparent; color: var(--ink-700); box-shadow: none; min-height: 0; }
    .drop:hover, .drop.over { background: color-mix(in srgb, var(--ink-900) 4%, transparent); transform: none; box-shadow: none; }
    .drop svg { width: 22px; height: 22px; color: var(--ink-400); transition: transform .2s; }
    .drop.over svg { transform: translateY(-2px); }
    .drop strong { font-size: 13px; font-weight: 600; }
    .drop small { font-size: 11.5px; color: var(--ink-400); }

    .preview { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px; }
    /* الصورة المرفوعة على ورقة بيضاء دائماً (كما ستُطبع) */
    .preview img { max-height: 118px; max-width: 100%; object-fit: contain; padding: 6px 12px; border-radius: 10px; background: #fff; }

    .consent { margin: 0; font-size: 11.5px; line-height: 1.7; color: var(--ink-500); }
    .password { max-width: 320px; }

    @media (prefers-reduced-motion: reduce) { .pill, .rule-hint, .inks span, .drop svg { transition: none; } }
  `]
})
export class SignaturePad {
  busy = input(false);
  error = input('');
  /** الصورة (data URL) وكلمة المرور */
  accepted = output<{ image: string; password: string }>();
  cancel = output<void>();

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
