import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenancePrint } from '../data-access/maintenance.models';
import { formatPhone } from '@core/utils/phone';
import { Logo } from '@shared/ui/logo';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { BackButton } from '@shared/ui/back-button';

/** ترويسة المطبوعات — عدّلها هنا عند اعتماد الترويسة الرسمية */
export const PRINT_HEADER = {
  organization: 'الجمهورية العربية السورية',
  system: 'نظام إدارة سير العمل — EWMS',
  fallbackUnit: 'قسم الصيانة'
};

type Kind = 'receipt' | 'delivery';

/**
 * صفحة طباعة (خارج الإطار العام): إيصال استلام الجهاز من العميل، أو ورقة تسليمه بعد الصيانة
 * وعليها التوقيع الإلكتروني لصاحب صلاحية SignMaintenanceReceipt في قسم الطلب (صورة يرفعها من ملفه الشخصي).
 * الورقة بألوان ثابتة (ورق أبيض) بصرف النظر عن مظهر التطبيق.
 */
@Component({
  selector: 'app-maintenance-print', standalone: true, imports: [BackButton, UtcPipe, DatePipe, Logo],
  templateUrl: './request-print-page.html',
  styleUrl: './request-print-page.scss'
})
export class MaintenancePrintPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  /** وجهة الرجوع إن فُتحت الورقة برابط مباشر: صفحة الطلب نفسه */
  backUrl = '/maintenance/requests/' + this.route.snapshot.paramMap.get('id');
  private location = inject(Location);

  header = PRINT_HEADER;
  phone = formatPhone;
  today = new Date();

  data = signal<MaintenancePrint | null>(null);
  error = signal('');
  private kindParam = signal<Kind>(this.route.snapshot.paramMap.get('kind') === 'delivery' ? 'delivery' : 'receipt');
  kind = computed(() => this.kindParam());

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    inject(MaintenanceService).printData(id).subscribe({
      next: d => this.data.set(d),
      error: e => this.error.set(e.message)
    });
  }

  setKind(kind: Kind) {
    this.kindParam.set(kind);
    // الرابط يتبع النوع المختار دون إضافة خطوة في سجل التصفح
    this.location.replaceState(this.router.createUrlTree(['/maintenance/print', this.data()?.request.id ?? this.route.snapshot.paramMap.get('id'), kind]).toString());
  }

  print() { window.print(); }

}
