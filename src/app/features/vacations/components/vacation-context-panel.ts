import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { VacationService } from '../data-access/vacation.service';
import { VacationApprovalContext } from '../data-access/vacation.models';
import { daysAr, vacationsAr } from '@core/utils/arabic-count';
import { trackRequest } from '@shared/ui/track-request';

/**
 * «سجل الموظف» داخل بطاقة طلب الإجازة قبل القرار (قرار المستخدم 2026-10-04): مطوي، ويُحمَّل عند أول فتح.
 * آخر إجازة، الشهر الجاري، الدفع لو اعتُمد الآن، زملاء القسم في نفس الفترة (بالأسماء)، طلباته المعلّقة الأخرى.
 */
@Component({
  selector: 'app-vacation-context-panel', standalone: true, imports: [DatePipe],
  templateUrl: './vacation-context-panel.html',
  styleUrl: './vacation-context-panel.scss'
})
export class VacationContextPanel {
  private service = inject(VacationService);
  vacationId = input.required<number>();

  open = signal(false);
  loading = signal(false);
  error = signal('');
  data = signal<VacationApprovalContext | null>(null);
  days = daysAr;
  vacations = vacationsAr;

  toggle() {
    this.open.update(v => !v);
    if (this.open() && !this.data() && !this.loading()) this.load();
  }

  load() {
    trackRequest(this.service.approvalContext(this.vacationId()), this.loading, this.error, d => { this.data.set(d); });
  }
}
