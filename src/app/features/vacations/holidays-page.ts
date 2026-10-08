import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { VacationService } from '@core/services/vacation.service';
import { PublicHoliday } from '@core/models/vacation.models';
import { vacationDateRange } from './vacation-validators';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** العطل الرسمية: أيام لا تُحسب من مدة الإجازة، إضافة إلى الجمعة (العطلة الأسبوعية) */
@Component({
  selector: 'app-holidays-page', standalone: true, imports: [ReactiveFormsModule, DatePipe, Pager],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">إعدادات الإجازات</span><h1>العطل الرسمية</h1><p class="muted">لا تُحسب من مدة الإجازة، مثل يوم الجمعة.</p></div>
        <div class="actions">
          <select [value]="year()" (change)="setYear(+$any($event.target).value)" aria-label="السنة">
            @for (y of years; track y) { <option [value]="y">{{ y }}</option> }
          </select>
          <button class="btn btn-ghost" (click)="load()" [disabled]="loading() || saving()">تحديث</button>
        </div>
      </header>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (success()) { <p class="alert alert-success" role="status">{{ success() }}</p> }
      @if (editing() ? can().edit : can().create) {
      <section class="panel"><div class="panel-heading"><h2>{{ editing() ? 'تعديل العطلة' : 'إضافة عطلة' }}</h2></div>
        <form [formGroup]="form" (ngSubmit)="save()" class="form-grid">
          <label class="form-field">الاسم<input formControlName="name" maxlength="100" placeholder="مثال: عيد الفطر"></label>
          <label class="form-field">{{ editing() ? 'التاريخ' : 'من تاريخ' }}<input type="date" formControlName="startVac"></label>
          @if (!editing()) { <label class="form-field">إلى تاريخ (اختياري)<input type="date" formControlName="endVac" [min]="form.controls.startVac.value"></label> }
          @if (form.hasError('dateRange')) { <p class="form-error full-width">تاريخ النهاية يجب أن يساوي تاريخ البداية أو يليه.</p> }
          @if (!editing()) { <p class="muted full-width">لعطلة من عدة أيام (كالعيد) حدّد المدة، فيُضاف يوم لكل تاريخ.</p> }
          <div class="actions full-width"><button class="btn" type="submit" [disabled]="saving() || form.invalid">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ العطلة' }}</button>@if (editing()) { <button class="btn btn-ghost" type="button" (click)="reset()" [disabled]="saving()">إلغاء</button> }</div>
        </form>
      </section>
      }
      <section class="panel">
        @if (loading()) { <p class="empty-state">جارٍ التحميل…</p> }
        @else if (!items().length && !error()) { <p class="empty-state">لا توجد عطل رسمية مسجّلة لسنة {{ year() }}.</p> }
        @else {
          <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>العطلة</th><th>الإجراءات</th></tr></thead><tbody>
            @for (h of pager.items(); track h.id) {
              <tr>
                <td>{{ h.date | date:'yyyy/MM/dd' }}</td>
                <td>{{ dayName(h.date) }}@if (h.isFriday) { <small class="muted"> (جمعة أصلاً)</small> }</td>
                <td>{{ h.name }}</td>
                <td><div class="actions">@if (can().edit) { <button class="btn btn-ghost btn-sm" (click)="edit(h)" [disabled]="saving()">تعديل</button> }@if (can().delete) { <button class="btn btn-danger btn-sm" (click)="deleting.set(h)" [disabled]="saving()">حذف</button> }</div></td>
              </tr>
            }
          </tbody></table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
        @if (deleting(); as h) { <div class="alert alert-warning">حذف عطلة «{{ h.name }}» ({{ h.date | date:'yyyy/MM/dd' }})؟ <button class="btn btn-danger" (click)="remove(h)" [disabled]="saving()">تأكيد الحذف</button><button class="btn btn-ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button></div> }
      </section>
    </div>`
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
    this.loading.set(true); this.error.set('');
    this.service.holidays(this.year()).subscribe({
      next: v => { this.items.set(v); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e.message); }
    });
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
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.deleteHoliday(h.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); if (this.editing() === h.id) this.reset(); this.success.set('تم حذف العطلة'); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
