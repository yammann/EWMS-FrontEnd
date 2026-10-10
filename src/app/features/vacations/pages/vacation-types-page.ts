import { Component, computed, inject } from '@angular/core';
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
import { VacationType } from '../data-access/vacation.models';

type TypeBody = { name: string; description: string; isPaid: boolean };

/** أنواع الإجازات — النمط الموحّد لصفحات الإدارة (CrudPage): نافذة للإضافة والتعديل، تأكيد للحذف */
@Component({
  selector: 'app-vacation-types', standalone: true,
  imports: [PageHeader, EmptyState, Alert, ReactiveFormsModule, Pager, Modal, FormActions, RowActions],
  styleUrl: '../../../shared/styles/page-base.scss',
  templateUrl: './vacation-types-page.html'
})
export class VacationTypesPage {
  private auth = inject(AuthService);
  private service = inject(VacationService);

  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateVacationType),
    edit: this.auth.hasPermission(AppPermission.EditVacationType),
    delete: this.auth.hasPermission(AppPermission.DeleteVacationType)
  }));

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    isPaid: [true]
  });

  crud = new CrudPage<VacationType, TypeBody>({
    load: () => this.service.types(),
    create: body => this.service.createType(body),
    update: (id, body) => this.service.updateType(id, body),
    remove: v => this.service.deleteType(v.id),
    can: { create: () => this.can().create, edit: () => this.can().edit, delete: () => this.can().delete },
    onOpen: v => this.form.reset({ name: v?.name ?? '', description: v?.description ?? '', isPaid: v?.isPaid ?? true }),
    messages: {
      saved: 'تم حفظ نوع الإجازة', deleted: 'تم حذف النوع', plural: 'أنواع الإجازات',
      confirmDelete: v => `حذف نوع الإجازة «${v.name}»؟ لا يمكن حذف نوع مستخدم في طلبات إجازة.`
    }
  });

  pager = new Pagination(() => this.crud.items());

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), description: v.description.trim(), isPaid: v.isPaid };
    if (!body.name) return this.crud.fail('أدخل اسم نوع الإجازة');
    this.crud.save(body);
  }
}
