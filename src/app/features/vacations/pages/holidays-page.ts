import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Pagination } from '@core/utils/pagination';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { EmptyState } from '@shared/ui/empty-state';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { VacationService } from '../data-access/vacation.service';
import { PublicHoliday } from '../data-access/vacation.models';
import { vacationDateRange } from '../utils/vacation-validators';
import { daysAr, fridaysAr } from '@core/utils/arabic-count';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type HolidayBody = { name: string; startDate: string; endDate: string | null };

/**
 * العطل الرسمية: أيام لا تُحسب من مدة الإجازة، إضافة إلى الجمعة (العطلة الأسبوعية) — النمط الموحّد (CrudPage).
 * كل عطلة بند واحد بفترة من–إلى (قرار المستخدم 2026-10-13): العيد من عدة أيام يُعدَّل ويُحذف كاملاً.
 */
@Component({
  selector: 'app-holidays-page', standalone: true,
  imports: [PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager, Modal, FormActions, RowActions],
  styleUrl: '../../../shared/styles/page-base.scss',
  templateUrl: './holidays-page.html',
  styles: [`.year-select { width: auto; min-width: 110px; } .nowrap { white-space: nowrap; font-variant-numeric: tabular-nums; }`]
})
export class HolidaysPage {
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

  // نفس أسماء حقول نموذج الإجازة كي يُعاد استخدام vacationDateRange
  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    startVac: ['', Validators.required], endVac: ['']
  }, { validators: vacationDateRange });

  crud = new CrudPage<PublicHoliday, HolidayBody, PublicHoliday>({
    load: () => this.service.holidays(this.year()),
    create: b => this.service.createHoliday(b),
    update: (id, b) => this.service.updateHoliday(id, b),
    remove: h => this.service.deleteHoliday(h.id),
    can: { create: () => this.can().create, edit: () => this.can().edit, delete: () => this.can().delete },
    onOpen: h => this.form.reset({
      name: h?.name ?? '', startVac: h?.startDate.slice(0, 10) ?? '',
      endVac: h && h.endDate.slice(0, 10) !== h.startDate.slice(0, 10) ? h.endDate.slice(0, 10) : ''
    }),
    messages: {
      saved: (_, mode) => mode === 'edit' ? 'تم حفظ العطلة' : 'تمت إضافة العطلة',
      deleted: 'تم حذف العطلة', plural: 'العطل',
      confirmDelete: h => `حذف عطلة «${h.name}» (${this.period(h)}) كاملة؟`
    }
  });

  pager = new Pagination(() => this.crud.items());
  days = daysAr;
  fridays = fridaysAr;

  dayName(date: string) { return DAY_NAMES[new Date(date.slice(0, 10) + 'T00:00:00').getDay()]; }
  isRange(h: PublicHoliday) { return h.startDate.slice(0, 10) !== h.endDate.slice(0, 10); }
  /** «2026/10/20» أو «2026/10/20 – 2026/10/25» */
  period(h: PublicHoliday) {
    const day = (d: string) => d.slice(0, 10).replaceAll('-', '/');
    return this.isRange(h) ? `${day(h.startDate)} – ${day(h.endDate)}` : day(h.startDate);
  }
  setYear(y: number) { this.year.set(y); this.crud.reload(); }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const name = v.name.trim();
    if (!name) return this.crud.fail('أدخل اسم العطلة');
    this.crud.save({ name, startDate: v.startVac, endDate: v.endVac || null });
  }
}
