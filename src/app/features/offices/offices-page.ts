import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Department, Office } from '../../core/models/ewms.models';
import { EwmsService } from '../../core/services/ewms.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PageActions } from '../../shared/ui/page-actions';

type ModalType = 'create' | 'edit';

/** المكاتب: زر «مكتب جديد» ونافذة منبثقة للإضافة والتعديل — نفس نمط صفحة الأقسام */
@Component({
  selector: 'app-offices-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal],
  templateUrl: './offices-page.html',
  styleUrl: './offices-page.scss'
})
export class OfficesPage {
  private auth = inject(AuthService);
  private service = inject(EwmsService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  /** زر لكل صلاحية: الصفحة تُفتح بالعرض، والأزرار تظهر حسب الإضافة/التعديل/الحذف */
  can = computed(() => ({
    create: this.auth.hasPermission(AppPermission.CreateOffice),
    edit: this.auth.hasPermission(AppPermission.EditOffice),
    delete: this.auth.hasPermission(AppPermission.DeleteOffice)
  }));

  items = signal<Office[]>([]);
  departments = signal<Department[]>([]);
  selected = signal<Office | null>(null);
  activeModal = signal<ModalType | null>(null);
  loading = signal(true);
  private actions = new PageActions(() => this.load());
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

  constructor() { this.load(); }

  /* =====================================================
   * Data loading
   * ===================================================== */
  load() {
    this.loading.set(true);
    forkJoin({ offices: this.service.getOffices(), departments: this.service.getDepartments() }).subscribe({
      next: r => { this.items.set(r.offices); this.departments.set(r.departments); this.loading.set(false); },
      error: error => { this.loading.set(false); this.actions.loadFailed(error); }
    });
  }

  /* =====================================================
   * Modal control
   * ===================================================== */
  openCreate() {
    if (!this.can().create) {
      this.toast.show('لا تملك صلاحية إضافة المكاتب', 'error');
      return;
    }
    this.selected.set(null);
    this.createForm.reset({ name: '', description: '', departmentId: '' });
    this.activeModal.set('create');
  }

  openEdit(office: Office) {
    if (!this.can().edit) {
      this.toast.show('لا تملك صلاحية تعديل المكاتب', 'error');
      return;
    }
    this.selected.set(office);
    this.editForm.patchValue({
      name: office.name,
      description: office.description ?? '',
      departmentId: String(office.departmentId)
    });
    this.activeModal.set('edit');
  }

  closeModal() { this.activeModal.set(null); }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء مكتب جديد' : 'تعديل المكتب';
  }

  /* =====================================================
   * CRUD actions
   * ===================================================== */
  create() {
    if (this.createForm.invalid) return;
    const v = this.createForm.getRawValue();
    if ((v.name ?? '').trim().length < 2) { this.toast.show('أدخل اسماً صحيحاً للمكتب', 'error'); return; }

    this.actions.run('create', this.service.createOffice(this.body(v)), 'تم إنشاء المكتب بنجاح', () => {
      this.createForm.reset();
      this.closeModal();
    });
  }

  update() {
    const office = this.selected();
    if (!office || this.editForm.invalid) return;
    const v = this.editForm.getRawValue();
    if ((v.name ?? '').trim().length < 2) { this.toast.show('أدخل اسماً صحيحاً للمكتب', 'error'); return; }

    this.actions.run('edit', this.service.updateOffice(office.id, this.body(v)), 'تم تعديل المكتب بنجاح', () => this.closeModal());
  }

  deleteOffice(office: Office) {
    if (!this.can().delete) {
      this.toast.show('لا تملك صلاحية حذف المكاتب', 'error');
      return;
    }
    this.confirm.ask(
      `هل أنت متأكد من حذف المكتب "${office.name}"؟ لا يمكن حذف مكتب مرتبط بموظفين، ولا يمكن التراجع عن هذا الإجراء.`,
      'تأكيد الحذف'
    ).then(confirmed => { if (confirmed) this.performDelete(office); });
  }

  private performDelete(office: Office) {
    this.actions.run(`delete-${office.id}`, this.service.deleteOffice(office.id), 'تم حذف المكتب بنجاح', () => {
      if (this.selected()?.id === office.id) this.selected.set(null);
    });
  }

  private body(v: { name: string | null; description: string | null; departmentId: string | null }) {
    const form = new FormData();
    form.append('Name', (v.name ?? '').trim());
    form.append('Description', (v.description ?? '').trim());
    form.append('DepartmentId', v.departmentId ?? '');
    return form;
  }
}
