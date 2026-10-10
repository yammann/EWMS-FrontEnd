import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VacationService } from '../data-access/vacation.service';
import { VacationPrint } from '../data-access/vacation.models';
import { Logo } from '@shared/ui/logo';
import { daysAr } from '@core/utils/arabic-count';
import { BackButton } from '@shared/ui/back-button';

/** ترويسة نموذج طلب الإجازة: الدولة، ثم اسم فرع الطلب (يُملأ تلقائياً من فرع مقدّم الطلب لحظة التقديم) */
export const VACATION_PRINT_HEADER = {
  countryAr: 'الجمهورية العربية السورية',
  countryEn: 'Syrian Arab Republic'
};


/**
 * نموذج «طلب إجازة» بشكل الورقة المعتمدة في المؤسسة (صورة النموذج من المستخدم 2026-10-04):
 * ترويسة + بيانات مقدم الطلب + نوع الإجازة + السبب + رأي رئيس الفرع وتوقيعه ومكان الختم.
 * صفحة خارج الإطار العام، والورقة بألوان ثابتة (ورق أبيض) بصرف النظر عن مظهر التطبيق.
 */
@Component({
  selector: 'app-vacation-print', standalone: true, imports: [BackButton, DatePipe, Logo],
  templateUrl: './vacation-print-page.html',
  styleUrl: './vacation-print-page.scss'
})
export class VacationPrintPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  header = VACATION_PRINT_HEADER;
  days = daysAr;
  data = signal<VacationPrint | null>(null);
  error = signal('');

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    inject(VacationService).printData(id).subscribe({
      next: d => this.data.set(d),
      error: e => this.error.set(e.message)
    });
  }

  print() { window.print(); }

}
