import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { ToastService } from '../../shared/ui/toast.service';

const WIDTH = 560, HEIGHT = 200;

/**
 * توقيعي الإلكتروني (ManageMySignature): يُرسم بالفأرة/اللمس أو تُرفع صورته، ويُحفظ PNG بخلفية شفافة وبحجم ثابت صغير.
 * كل حفظ نسخة جديدة، والنسخة الحالية تُحفظ مع كل قرار أوقّعه (الاعتماد النهائي للإجازة، الرفض) فلا تتغير الأوراق القديمة.
 * الحفظ والحذف يطلبان كلمة المرور (قرار المستخدم 2026-10-04).
 */
@Component({
  selector: 'app-signature-panel', standalone: true,
  template: `
    <section class="panel">
      <div class="panel-heading"><div><span class="panel-kicker">الهوية</span><h2>توقيعي الإلكتروني</h2>
        <p>يُحفظ مع قراراتك الموقَّعة (الاعتماد النهائي للإجازات والرفض) ويُطبع على الأوراق. ارسم توقيعك في المربع أو ارفع صورته.
          تغيير التوقيع لاحقاً لا يغيّر الأوراق التي وقّعتها سابقاً.</p></div></div>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="pad-wrap">
        <canvas #pad [attr.width]="width" [attr.height]="height" aria-label="مساحة رسم التوقيع"
                (pointerdown)="start($event)" (pointermove)="move($event)" (pointerup)="end()" (pointerleave)="end()" (pointercancel)="end()"></canvas>
        @if (empty() && !loading()) { <span class="placeholder" aria-hidden="true">وقّع هنا</span> }
      </div>

      <label class="form-field password">كلمة المرور (لتأكيد حفظ التوقيع أو حذفه)
        <input type="password" autocomplete="current-password" [value]="password()" (input)="password.set($any($event.target).value)">
      </label>

      <div class="actions">
        <button type="button" class="btn" (click)="save()" [disabled]="saving() || loading() || !dirty() || !password()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ التوقيع' }}</button>
        <label class="btn btn-ghost upload">رفع صورة<input type="file" accept="image/png,image/jpeg" (change)="upload($event)" hidden></label>
        <button type="button" class="btn btn-ghost" (click)="clear()" [disabled]="empty() || saving()">مسح</button>
        @if (saved()) { <button type="button" class="btn btn-danger" (click)="remove()" [disabled]="saving() || !password()">حذف التوقيع المحفوظ</button> }
        <span class="state">{{ loading() ? 'جارٍ التحميل…' : saved() ? (dirty() ? 'تعديلات غير محفوظة' : '✓ توقيعك محفوظ') : 'لا يوجد توقيع محفوظ' }}</span>
      </div>
    </section>`,
  styles: [`
    .pad-wrap { position: relative; width: min(100%, 560px); }
    /* ورقة بيضاء دائماً: الحبر داكن ويُطبع على ورق أبيض */
    canvas { display: block; width: 100%; height: auto; aspect-ratio: 560 / 200; background: #fff; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); touch-action: none; cursor: crosshair; }
    .placeholder { position: absolute; inset: 0; display: grid; place-items: center; color: #b8b8c0; font-size: 18px; pointer-events: none; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
    .upload { cursor: pointer; }
    .password { max-width: 320px; margin-top: 14px; }
    .state { font-size: 12px; color: var(--ink-500); margin-inline-start: auto; }
  `]
})
export class SignaturePanel {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private pad = viewChild.required<ElementRef<HTMLCanvasElement>>('pad');

  width = WIDTH; height = HEIGHT;
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  empty = signal(true);
  dirty = signal(false);
  saved = signal(false);
  password = signal('');

  private drawing = false;
  private last: { x: number; y: number } | null = null;

  constructor() {
    afterNextRender(() => {
      this.service.mySignature().subscribe({
        next: r => { if (r.image) { this.saved.set(true); this.drawImage(r.image, false); } this.loading.set(false); },
        error: e => { this.error.set(e.message); this.loading.set(false); }
      });
    });
  }

  private get ctx() { return this.pad().nativeElement.getContext('2d')!; }

  private point(event: PointerEvent) {
    const canvas = this.pad().nativeElement, rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }

  start(event: PointerEvent) {
    event.preventDefault();
    this.pad().nativeElement.setPointerCapture(event.pointerId);
    this.drawing = true;
    this.last = this.point(event);
  }

  move(event: PointerEvent) {
    if (!this.drawing || !this.last) return;
    const p = this.point(event), ctx = this.ctx;
    ctx.strokeStyle = '#14141a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    this.last = p;
    if (this.empty()) this.empty.set(false);
    if (!this.dirty()) this.dirty.set(true);
  }

  end() { this.drawing = false; this.last = null; }

  clear() {
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.empty.set(true);
    this.dirty.set(this.saved());
  }

  upload(event: Event) {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.drawImage(String(reader.result), true);
    reader.onerror = () => this.error.set('تعذّر قراءة الصورة');
    reader.readAsDataURL(file);
  }

  /** يرسم الصورة داخل المساحة مع الحفاظ على نسبتها */
  private drawImage(src: string, markDirty: boolean) {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(WIDTH / image.width, HEIGHT / image.height);
      const w = image.width * scale, h = image.height * scale;
      this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
      this.ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
      this.empty.set(false);
      this.dirty.set(markDirty);
    };
    image.onerror = () => this.error.set('الصورة غير صالحة');
    image.src = src;
  }

  save() {
    if (this.empty()) { this.remove(); return; }
    this.send(this.pad().nativeElement.toDataURL('image/png'), 'تم حفظ التوقيع');
  }

  remove() {
    this.send(null, 'تم حذف التوقيع', () => { this.ctx.clearRect(0, 0, WIDTH, HEIGHT); this.empty.set(true); });
  }

  private send(image: string | null, message: string, done?: () => void) {
    if (!this.password()) { this.error.set('أدخل كلمة المرور لتأكيد التغيير'); return; }
    this.saving.set(true); this.error.set('');
    this.service.saveSignature(image, this.password()).subscribe({
      next: () => { this.saving.set(false); this.saved.set(!!image); this.dirty.set(false); this.password.set(''); done?.(); this.toast.success(message); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
