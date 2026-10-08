import { Component, inject, signal } from '@angular/core';
import { MaintenanceService } from '@features/maintenance';
import { ToastService } from '@shared/ui/toast.service';
import { SignaturePad } from './signature-pad';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/**
 * توقيعي الإلكتروني (ManageMySignature): بطاقة بالتوقيع الحالي، و«تغيير التوقيع» يفتح لوحة الرسم/الرفع في نافذة.
 * كل حفظ نسخة جديدة، والنسخة الحالية تُحفظ مع كل قرار أوقّعه (الاعتماد النهائي للإجازة، الرفض) فلا تتغير الأوراق القديمة.
 * الحفظ والحذف يطلبان كلمة المرور (قرار المستخدم 2026-10-04).
 */
@Component({
  selector: 'app-signature-panel', standalone: true, imports: [Alert, SignaturePad],
  template: `
    <section class="panel">
      <div class="panel-heading"><div><span class="panel-kicker">الهوية</span><h2>توقيعي الإلكتروني</h2>
        <p>يُحفظ مع قراراتك الموقَّعة (الاعتماد النهائي للإجازات والرفض) ويُطبع على الأوراق.
          تغيير التوقيع لاحقاً لا يغيّر الأوراق التي وقّعتها سابقاً.</p></div></div>

      <app-alert [message]="error()" />

      <div class="card">
        <div class="card-head">
          @if (loading()) { <span class="state">جارٍ التحميل…</span> }
          @else if (current()) { <span class="badge">✓</span><span class="state on">توقيعك محفوظ ومعتمد</span> }
          @else { <span class="state">لا يوجد توقيع محفوظ</span> }
        </div>
        <div class="paper" [class.empty]="!current()">
          @if (current(); as img) { <img [src]="img" alt="توقيعي الحالي"> }
          @else if (!loading()) { <span>أضف توقيعك ليُطبع على الأوراق التي توقّعها</span> }
        </div>
        <div class="card-actions">
          @if (removing()) {
            <label class="form-field remove-pass"><span class="form-label">كلمة المرور لتأكيد الحذف</span>
              <input type="password" autocomplete="current-password" [value]="password()" (input)="password.set($any($event.target).value)"
                     (keydown.enter)="remove()"></label>
            <button type="button" class="btn btn-danger" (click)="remove()" [disabled]="!password() || saving()">{{ saving() ? 'جارٍ الحذف…' : 'حذف التوقيع' }}</button>
            <button type="button" class="btn btn-ghost" (click)="removing.set(false); password.set('')" [disabled]="saving()">إلغاء</button>
          } @else {
            <button type="button" class="btn" (click)="open()" [disabled]="loading()">{{ current() ? 'تغيير التوقيع' : 'إضافة توقيع' }}</button>
            @if (current()) { <button type="button" class="btn btn-ghost" (click)="removing.set(true); error.set('')">حذف</button> }
          }
        </div>
      </div>
    </section>

    @if (padOpen()) {
      <app-signature-pad [busy]="saving()" [error]="padError()" (accepted)="save($event)" (cancel)="padOpen.set(false)" />
    }`,
  styles: [`
    .card { max-width: 560px; padding: 18px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface-raised, var(--surface)); }
    .card-head { display: flex; align-items: center; gap: 8px; min-height: 22px; }
    .badge { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 700;
      background: var(--brand-100); color: var(--brand-700); }
    .state { font-size: 13px; color: var(--ink-500); }
    .state.on { color: var(--ink-900); font-weight: 600; }
    /* ورقة بيضاء دائماً: هكذا يُطبع التوقيع */
    .paper { margin-top: 14px; height: 132px; display: flex; align-items: center; justify-content: center; padding: 12px 24px;
      border-radius: 14px; background: #fff; border: 1px solid var(--border); }
    .paper img { max-height: 100px; max-width: 100%; object-fit: contain; }
    .paper.empty { background: var(--fill); border-style: dashed; }
    .paper.empty span { font-size: 13px; color: var(--ink-400); text-align: center; }
    .card-actions { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-top: 14px; }
    .remove-pass { flex: 1 1 220px; max-width: 300px; margin: 0; }
  `]
})
export class SignaturePanel {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  padError = signal('');
  current = signal<string | null>(null);
  padOpen = signal(false);
  removing = signal(false);
  password = signal('');

  constructor() {
    this.service.mySignature().subscribe({
      next: r => { this.current.set(r.image); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  open() { this.padError.set(''); this.removing.set(false); this.padOpen.set(true); }

  save(result: { image: string; password: string }) {
    trackRequest(this.service.saveSignature(result.image, result.password), this.saving, this.padError, () => { this.padOpen.set(false); this.current.set(result.image); this.toast.success('اعتُمد توقيعك الجديد'); });
  }

  remove() {
    if (!this.password() || this.saving()) return;
    trackRequest(this.service.saveSignature(null, this.password()), this.saving, this.error, () => { this.removing.set(false); this.password.set(''); this.current.set(null); this.toast.success('تم حذف التوقيع'); });
  }
}
