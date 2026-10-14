import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { passwordChecks, passwordProblem } from '@core/utils/password';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { Icon } from '@shared/ui/icon';
import { trackRequest } from '@shared/ui/track-request';

/**
 * تغيير كلمة المرور ذاتياً (PUT Auth/Password، قرار المستخدم 2026-10-13): الحالية + الجديدة مرتين.
 * عند النجاح ينهي الخادم كل جلسات المستخدم، فتُنظَّف الجلسة هنا ويُنقل إلى الدخول مع رسالة تأكيد.
 */
@Component({
  selector: 'app-password-dialog', standalone: true, imports: [Modal, Alert, Icon],
  template: `
    <app-modal heading="تغيير كلمة المرور" kicker="الأمان" [busy]="saving()" (closed)="closed.emit()">
      <form (submit)="$event.preventDefault(); submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">كلمة المرور الحالية</span>
            <input #c type="password" autocomplete="current-password" [value]="current()" (input)="current.set(c.value)"></label>
          <label class="form-field"><span class="form-label">كلمة المرور الجديدة</span>
            <input #n type="password" autocomplete="new-password" [value]="next()" (input)="next.set(n.value)"></label>
          <ul class="checks" aria-label="شروط كلمة المرور">
            @for (check of checks(); track check.label) {
              <li [class.ok]="check.ok"><app-icon [name]="check.ok ? 'checkmark' : 'xmark'" [size]="13" [weight]="2.4" /> {{ check.label }}</li>
            }
          </ul>
          <label class="form-field"><span class="form-label">تأكيد كلمة المرور الجديدة</span>
            <input #r type="password" autocomplete="new-password" [value]="repeat()" (input)="repeat.set(r.value)"></label>
          @if (repeat() && repeat() !== next()) { <small class="form-error">التأكيد لا يطابق كلمة المرور الجديدة.</small> }
          <p class="form-hint">بعد التغيير تُغلق كل جلساتك (على هذا الجهاز وغيره) وتدخل بكلمة المرور الجديدة.</p>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="!canSubmit()">{{ saving() ? 'جارٍ الحفظ…' : 'تغيير كلمة المرور' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .checks { list-style: none; margin: -4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--ink-500); }
    .checks li { display: inline-flex; align-items: center; gap: 4px; }
    .checks li.ok { color: var(--brand-700); }
  `]
})
export class PasswordDialog {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** بريد المستخدم: كلمة المرور لا تساويه ولا جزأه الأول */
  email = input<string | null | undefined>('');
  closed = output<void>();

  current = signal('');
  next = signal('');
  repeat = signal('');
  saving = signal(false);
  error = signal('');

  checks = computed(() => passwordChecks(this.next()));
  canSubmit = computed(() => !this.saving() && !!this.current() && !!this.next() && this.next() === this.repeat());

  submit() {
    if (!this.canSubmit()) return;
    const problem = passwordProblem(this.next(), this.email());
    if (problem) { this.error.set(problem); return; }
    if (this.next() === this.current()) { this.error.set('كلمة المرور الجديدة يجب أن تختلف عن الحالية'); return; }
    trackRequest(this.api.put<{ message: string }>('/Auth/Password', { currentPassword: this.current(), newPassword: this.next() }),
      this.saving, this.error, () => this.auth.clearSession('password-changed'));
  }
}
