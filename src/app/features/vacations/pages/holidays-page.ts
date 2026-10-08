import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { VacationService } from '../data-access/vacation.service';
import { PublicHoliday } from '../data-access/vacation.models';
import { vacationDateRange } from '../utils/vacation-validators';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { trackRequest } from '@shared/ui/loader';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** العطل الرسمية: أيام لا تُحسب من مدة الإجازة، إضافة إلى الجمعة (العطلة الأسبوعية) */
@Component({
  selector: 'app-holidays-page', standalone: true, imports: [EmptyState, Alert, ReactiveFormsModule, DatePipe, Pager],
  styleUrl: '../../../shared/styles/page-base.scss',
  templateUrl: './holidays-page.html'
})
export class HolidaysPage {
  pager = new Pagination(() => this.items());
  private auth = inject(AuthService);
  private service = inject(VacationService);
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateHoliday),
    edit: this.auth.hasPermission(AppPermission.EditHoliday),
    delete: this.auth.hasPermission(AppPermission.DeleteHoliday)
  }));
  private thisYear = new Date().getFullYear();
  years = [this.thisYear - 1, this.thisYear, this.thisYear + 1, this.thisYear + 2];
  year = signal(this.thisYear);
  items = signal<PublicHoliday[]>([]); editing = signal<number | null>(null); deleting = signal<PublicHoliday | null>(null);
  loading = signal(false); saving = signal(false); error = signal(''); success = signal('');
  // نفس أسماء حقول نموذج الإجازة كي يُعاد استخدام vacationDateRange
  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    startVac: ['', Validators.required], endVac: ['']
  }, { validators: vacationDateRange });

  constructor() { this.load(); }
  dayName(date: string) { return DAY_NAMES[new Date(date.slice(0, 10) + 'T00:00:00').getDay()]; }
  setYear(y: number) { this.year.set(y); this.load(); }
  load() {
    trackRequest(this.service.holidays(this.year()), this.loading, this.error, v => { this.items.set(v); });
  }
  reset() { this.editing.set(null); this.form.reset(); }
  edit(h: PublicHoliday) {
    this.editing.set(h.id);
    this.form.setValue({ name: h.name, startVac: h.date.slice(0, 10), endVac: '' });
  }
  save() {
    if (this.saving() || this.form.invalid) return;
    const v = this.form.getRawValue();
    const name = v.name.trim();
    if (!name) { this.error.set('أدخل اسم العطلة'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    const id = this.editing();
    const done = (message: string) => { this.saving.set(false); this.success.set(message); this.reset(); this.load(); };
    const fail = (e: Error) => { this.saving.set(false); this.error.set(e.message); };
    if (id) this.service.updateHoliday(id, { date: v.startVac, name }).subscribe({ next: () => done('تم حفظ العطلة'), error: fail });
    else this.service.createHoliday({ date: v.startVac, endDate: v.endVac || null, name }).subscribe({
      next: added => done(added.length > 1 ? `تمت إضافة ${added.length} أيام عطلة` : 'تمت إضافة العطلة'), error: fail
    });
  }
  remove(h: PublicHoliday) {
    if (this.saving()) return;
    this.success.set('');
    trackRequest(this.service.deleteHoliday(h.id), this.saving, this.error, () => { this.deleting.set(null); if (this.editing() === h.id) this.reset(); this.success.set('تم حذف العطلة'); this.load(); });
  }
}
