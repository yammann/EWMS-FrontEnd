import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppPermission } from '@core/constants/access';
import { Branch } from '@core/models/ewms.models';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { Pagination } from '@core/utils/pagination';
import { AdminHeader } from '@shared/ui/admin-header';
import { CrudMode, CrudPage } from '@shared/ui/crud-page';
import { EntityForm } from '@shared/ui/entity-form';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { StatTile } from '@shared/ui/stat-tile';
import { BranchService } from '../data-access/branch.service';

/** الفروع — النمط الموحّد لصفحات الإدارة (CrudPage) */
@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [EntityForm, RowActions, StatTile, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage {
  private branchService = inject(BranchService);
  private lookups = inject(LookupsService);
  private auth = inject(AuthService);

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateBranch));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditBranch));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteBranch));

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  crud = new CrudPage<Branch, FormData>({
    load: () => this.branchService.getAll(),
    create: body => this.branchService.create(body),
    update: (id, body) => this.branchService.update(id, body),
    remove: b => this.branchService.delete(b.id),
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    onOpen: b => this.form.reset({ name: b?.name ?? '', description: b?.description ?? '' }),
    onRefresh: () => this.lookups.invalidate(),
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء الفرع بنجاح' : 'تم تعديل الفرع بنجاح',
      deleted: 'تم حذف الفرع بنجاح', plural: 'الفروع', confirmLabel: 'تأكيد الحذف',
      confirmDelete: b => `هل أنت متأكد من حذف الفرع "${b.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
    }
  });

  branches = this.crud.items;
  pager = new Pagination(() => this.branches());

  stats = computed(() => {
    const branches = this.branches();
    return {
      total: branches.length,
      withDescription: branches.filter(b => !!b.description).length,
      withoutDescription: branches.filter(b => !b.description).length
    };
  });

  title(mode: CrudMode) { return mode === 'create' ? 'إنشاء فرع جديد' : 'تعديل الفرع'; }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const f = new FormData();
    f.append('Name', v.name ?? ''); f.append('Description', v.description ?? '');
    this.crud.save(f);
  }
}
