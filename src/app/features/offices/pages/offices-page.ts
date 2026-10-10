import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { Department, Office } from '@core/models/ewms.models';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { Pagination } from '@core/utils/pagination';
import { AdminHeader } from '@shared/ui/admin-header';
import { CrudMode, CrudPage } from '@shared/ui/crud-page';
import { EntityForm } from '@shared/ui/entity-form';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { OfficeService } from '../data-access/office.service';

/** المكاتب — النمط الموحّد لصفحات الإدارة (CrudPage) */
@Component({
  selector: 'app-offices-page',
  standalone: true,
  imports: [EntityForm, RowActions, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './offices-page.html',
  styleUrl: './offices-page.scss'
})
export class OfficesPage {
  private auth = inject(AuthService);
  private service = inject(OfficeService);
  private lookups = inject(LookupsService);

  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateOffice),
    edit: this.auth.hasPermission(AppPermission.EditOffice),
    delete: this.auth.hasPermission(AppPermission.DeleteOffice)
  }));

  departments = signal<Department[]>([]);

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    departmentId: ['', Validators.required]
  });

  crud = new CrudPage<Office, FormData>({
    load: () => forkJoin({ offices: this.service.getAll(), departments: this.lookups.departments() })
      .pipe(map(r => { this.departments.set(r.departments); return r.offices; })),
    create: body => this.service.create(body),
    update: (id, body) => this.service.update(id, body),
    remove: o => this.service.delete(o.id),
    can: { create: () => this.can().create, edit: () => this.can().edit, delete: () => this.can().delete },
    onOpen: o => this.form.reset({ name: o?.name ?? '', description: o?.description ?? '', departmentId: o ? String(o.departmentId) : '' }),
    onRefresh: () => this.lookups.invalidate(),
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء المكتب بنجاح' : 'تم تعديل المكتب بنجاح',
      deleted: 'تم حذف المكتب بنجاح', plural: 'المكاتب', confirmLabel: 'تأكيد الحذف',
      confirmDelete: o => `هل أنت متأكد من حذف المكتب "${o.name}"؟ لا يمكن حذف مكتب مرتبط بموظفين، ولا يمكن التراجع عن هذا الإجراء.`
    }
  });

  items = this.crud.items;
  pager = new Pagination(() => this.items());

  title(mode: CrudMode) { return mode === 'create' ? 'إنشاء مكتب جديد' : 'تعديل المكتب'; }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if ((v.name ?? '').trim().length < 2) return this.crud.fail('أدخل اسماً صحيحاً للمكتب');
    const f = new FormData();
    f.append('Name', (v.name ?? '').trim()); f.append('Description', (v.description ?? '').trim()); f.append('DepartmentId', v.departmentId ?? '');
    this.crud.save(f);
  }
}
