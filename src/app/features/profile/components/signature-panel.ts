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
  templateUrl: './signature-panel.html',
  styleUrl: './signature-panel.scss'
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
