import { Pagination } from '@core/utils/pagination';
import { RowActions } from '@shared/ui/row-actions';
import { AdminHeader } from '@shared/ui/admin-header';
import { loader } from '@shared/ui/loader';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Department, Office } from '@core/models/ewms.models';
import { OfficeService } from '../data-access/office.service';
import { LookupsService } from '@core/services/lookups.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';
import { PageActions } from '@shared/ui/page-actions';
import { ModalCrud } from '@shared/ui/modal-crud';

/** المكاتب: زر «مكتب جديد» ونافذة منبثقة للإضافة والتعديل — نفس نمط صفحة الأقسام */
@Component({
  selector: 'app-offices-page',
  standalone: true,
  imports: [RowActions, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './offices-page.html',
  styleUrl: './offices-page.scss'
})
export class OfficesPage {
  private auth = inject(AuthService);
  private service = inject(OfficeService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);

  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateOffice),
    edit: this.auth.hasPermission(AppPermission.EditOffice),
    delete: this.auth.hasPermission(AppPermission.DeleteOffice)
  }));

  items = signal<Office[]>([]);
  pager = new Pagination(() => this.items());
  departments = signal<Department[]>([]);
  private actions = new PageActions(() => this.load(true));
  saving = this.actions.saving;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    departmentId: ['', Validators.required]
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    departmentId: ['', Validators.required]
  });

  crud = new ModalCrud({
    actions: this.actions, noun: 'المكتب', plural: 'المكاتب',
    titles: { create: 'إنشاء مكتب جديد', edit: 'تعديل المكتب' },
    can: { create: computed(() => this.can().create), edit: computed(() => this.can().edit), delete: computed(() => this.can().delete) },
    forms: { create: this.createForm, edit: this.editForm },
    createDefaults: { name: '', description: '', departmentId: '' },
    toEditValue: (o: Office) => ({ name: o.name, description: o.description ?? '', departmentId: String(o.departmentId) }),
    validate: v => (v.name ?? '').trim().length < 2 ? 'أدخل اسماً صحيحاً للمكتب' : null,
    toBody: v => {
      const f = new FormData();
      f.append('Name', (v.name ?? '').trim()); f.append('Description', (v.description ?? '').trim()); f.append('DepartmentId', v.departmentId ?? '');
      return f;
    },
    deleteWarning: 'لا يمكن حذف مكتب مرتبط بموظفين',
    service: this.service
  });

  /* =====================================================
   * Data loading
   * ===================================================== */
  private force = false;
  private data = loader(() => forkJoin({ offices: this.service.getAll(this.force), departments: this.lookups.departments(this.force) }), null, {
    onLoaded: r => { if (r) { this.items.set(r.offices); this.departments.set(r.departments); } },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }

}
