import { Pagination } from '../../core/utils/pagination';
import { Pager } from '../../shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VacationService } from '../../core/services/vacation.service';
import { VacationType } from '../../core/models/vacation.models';

@Component({
  selector: 'app-vacation-types', standalone: true, imports: [ReactiveFormsModule, Pager],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">إعدادات الإجازات</span><h1>أنواع الإجازات</h1></div><button class="btn btn-ghost" (click)="load()" [disabled]="loading() || saving()">تحديث</button></header>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (success()) { <p class="alert alert-success" role="status">{{ success() }}</p> }
      @if (editing() ? can().edit : can().create) {
      <section class="panel"><div class="panel-heading"><h2>{{ editing() ? 'تعديل النوع' : 'إضافة نوع إجازة' }}</h2></div>
        <form [formGroup]="form" (ngSubmit)="save()" class="form-grid">
          <label class="form-field">الاسم<input formControlName="name" maxlength="100"></label>
          <label class="form-field">الوصف<input formControlName="description" maxlength="500"></label>
          <label class="form-field">الدفع<select formControlName="isPaid"><option [ngValue]="true">نوع مدفوع</option><option [ngValue]="false">نوع غير مدفوع</option></select></label>
          <p class="muted full-width">يُحدَّد الدفع عند الاعتماد النهائي: يومان مدفوعان في الشهر لكل الأنواع المدفوعة معاً، والباقي غير مدفوع.</p>
          <div class="actions full-width"><button class="btn" type="submit" [disabled]="saving() || form.invalid">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ النوع' }}</button>@if (editing()) { <button class="btn btn-ghost" type="button" (click)="reset()" [disabled]="saving()">إلغاء</button> }</div>
        </form>
      </section>
      }
      <section class="panel">
        @if (loading()) { <p class="empty-state">جارٍ التحميل…</p> }
        @else if (!items().length && !error()) { <p class="empty-state">لا توجد أنواع إجازات بعد.</p> }
        @else { <div class="table-wrap"><table><thead><tr><th>النوع</th><th>الوصف</th><th>الدفع</th><th>الإجراءات</th></tr></thead><tbody>@for (v of pager.items(); track v.id) { <tr><td>{{ v.name }}</td><td class="wrap">{{ v.description || '—' }}</td><td>{{ v.paymentTypeAr }}</td><td><div class="actions">@if (can().edit) { <button class="btn btn-ghost btn-sm" (click)="edit(v)" [disabled]="saving()">تعديل</button> }@if (can().delete) { <button class="btn btn-danger btn-sm" (click)="deleting.set(v)" [disabled]="saving()">حذف</button> }</div></td></tr> }</tbody></table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" /> }
        @if (deleting(); as v) { <div class="alert alert-warning">حذف «{{ v.name }}»؟ <button class="btn btn-danger" (click)="remove(v)" [disabled]="saving()">تأكيد الحذف</button><button class="btn btn-ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button></div> }
      </section>
    </div>`
})
export class VacationTypesPage {
  pager = new Pagination(() => this.items());
  private auth = inject(AuthService);
  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والنموذج والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateVacationType),
    edit: this.auth.hasPermission(AppPermission.EditVacationType),
    delete: this.auth.hasPermission(AppPermission.DeleteVacationType)
  }));
  private service = inject(VacationService);
  items = signal<VacationType[]>([]); editing = signal<number | null>(null); deleting = signal<VacationType | null>(null);
  loading = signal(false); saving = signal(false); error = signal(''); success = signal('');
  form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(100)]], description: ['', Validators.maxLength(500)], isPaid: [true] });
  constructor() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.service.types().subscribe({ next: v => { this.items.set(v); this.loading.set(false); }, error: e => { this.loading.set(false); this.error.set(e.message); } });
  }
  reset() { this.editing.set(null); this.form.reset(); }
  edit(v: VacationType) { this.editing.set(v.id); this.form.patchValue(v); }
  save() {
    if (this.saving() || this.form.invalid) return;
    const v = this.form.getRawValue(); v.name = v.name.trim(); v.description = v.description.trim();
    if (!v.name) { this.error.set('أدخل اسم نوع الإجازة'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    const id = this.editing();
    (id ? this.service.updateType(id, v) : this.service.createType(v)).subscribe({
      next: () => { this.saving.set(false); this.success.set('تم حفظ نوع الإجازة'); this.reset(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
  remove(v: VacationType) {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.deleteType(v.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); if (this.editing() === v.id) this.reset(); this.success.set('تم حذف النوع'); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
