import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EwmsService } from '../../core/services/ewms.service';
import { Department, Office } from '../../core/models/ewms.models';

@Component({
  selector: 'app-offices-page', standalone: true, imports: [CommonModule, ReactiveFormsModule],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">الهيكل التنظيمي</span><h1>المكاتب</h1><p class="muted">إدارة مكاتب الأقسام وربطها بالموظفين</p></div><button class="btn btn-ghost" (click)="load()" [disabled]="loading() || saving()">تحديث</button></header>
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (success()) { <p class="alert alert-success" role="status">{{ success() }}</p> }
      @if (editing() ? can().edit : can().create) {
      <section class="panel"><div class="panel-heading"><h2>{{ editing() ? 'تعديل المكتب' : 'إضافة مكتب' }}</h2></div>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <label class="form-field">اسم المكتب<input formControlName="name" maxlength="100" placeholder="مثال: مكتب المتابعة"></label>
          <label class="form-field">القسم<select formControlName="departmentId"><option [ngValue]="0">اختر القسم</option>@for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.branchName }} / {{ d.name }}</option> }</select></label>
          <label class="form-field">الوصف<input formControlName="description" maxlength="500"></label>
          <div class="actions full-width"><button class="btn" type="submit" [disabled]="form.invalid || saving() || loading()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ المكتب' }}</button>@if (editing()) { <button class="btn btn-ghost" type="button" (click)="reset()" [disabled]="saving()">إلغاء التعديل</button> }</div>
        </form>
      </section>
      }
      <section class="panel"><div class="panel-heading"><h2>دليل المكاتب</h2><span class="muted">{{ items().length }} مكتب</span></div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!items().length && !error()) { <p class="empty-state">لا توجد مكاتب بعد. أضف مكتباً واختر القسم التابع له.</p> }
        @else { <div class="table-wrap"><table><thead><tr><th>المكتب</th><th>القسم</th><th>الفرع</th><th>الوصف</th><th>الإجراءات</th></tr></thead><tbody>
          @for (o of items(); track o.id) { <tr><td>{{ o.name }}</td><td>{{ o.departmentName }}</td><td>{{ o.branchName }}</td><td class="wrap">{{ o.description || '—' }}</td><td><div class="actions">@if (can().edit) { <button class="btn btn-ghost btn-sm" (click)="edit(o)" [disabled]="saving()">تعديل</button> }@if (can().delete) { <button class="btn btn-danger btn-sm" (click)="deleting.set(o)" [disabled]="saving()">حذف</button> }</div></td></tr> }
        </tbody></table></div> }
        @if (deleting(); as o) { <div class="alert alert-warning"><span>حذف المكتب «{{ o.name }}»؟ لا يمكن حذف مكتب مرتبط بموظفين.</span><button class="btn btn-danger" (click)="remove(o)" [disabled]="saving()">تأكيد الحذف</button><button class="btn btn-ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button></div> }
      </section>
    </div>`
})
export class OfficesPage {
  private auth = inject(AuthService);
  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والنموذج والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateOffice),
    edit: this.auth.hasPermission(AppPermission.EditOffice),
    delete: this.auth.hasPermission(AppPermission.DeleteOffice)
  }));
  private service = inject(EwmsService);
  items = signal<Office[]>([]); departments = signal<Department[]>([]);
  editing = signal<number | null>(null); deleting = signal<Office | null>(null);
  loading = signal(false); saving = signal(false); error = signal(''); success = signal('');
  form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]], description: ['', Validators.maxLength(500)], departmentId: [0, Validators.min(1)] });
  constructor() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ offices: this.service.getOffices(), departments: this.service.getDepartments() }).subscribe({
      next: r => { this.items.set(r.offices); this.departments.set(r.departments); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e.message); }
    });
  }
  reset() { this.editing.set(null); this.form.reset(); }
  edit(o: Office) { this.editing.set(o.id); this.form.patchValue(o); this.deleting.set(null); }
  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    if (v.name.trim().length < 2) { this.error.set('أدخل اسماً صحيحاً للمكتب'); return; }
    const body = new FormData(); body.append('Name', v.name.trim()); body.append('Description', v.description.trim()); body.append('DepartmentId', String(v.departmentId));
    this.saving.set(true); this.error.set(''); this.success.set('');
    const id = this.editing();
    (id ? this.service.updateOffice(id, body) : this.service.createOffice(body)).subscribe({
      next: () => { this.saving.set(false); this.success.set('تم حفظ المكتب'); this.reset(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
  remove(o: Office) {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.deleteOffice(o.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); if (this.editing() === o.id) this.reset(); this.success.set('تم حذف المكتب'); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
