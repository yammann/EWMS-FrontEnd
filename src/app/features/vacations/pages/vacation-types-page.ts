import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VacationService } from '../data-access/vacation.service';
import { VacationType } from '../data-access/vacation.models';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';

@Component({
  selector: 'app-vacation-types', standalone: true, imports: [PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager],
  styleUrl: '../../../shared/styles/page-base.scss',
  templateUrl: './vacation-types-page.html'
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
    trackRequest(this.service.types(), this.loading, this.error, v => { this.items.set(v); });
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
    this.success.set('');
    trackRequest(this.service.deleteType(v.id), this.saving, this.error, () => { this.deleting.set(null); if (this.editing() === v.id) this.reset(); this.success.set('تم حذف النوع'); this.load(); });
  }
}
