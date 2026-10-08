import { Pagination } from '@core/utils/pagination';
import { RowActions } from '@shared/ui/row-actions';
import { StatTile } from '@shared/ui/stat-tile';
import { AdminHeader } from '@shared/ui/admin-header';
import { loader } from '@shared/ui/loader';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { BranchService } from '../data-access/branch.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Modal } from '@shared/ui/modal';
import { PageActions } from '@shared/ui/page-actions';
import { ModalCrud } from '@shared/ui/modal-crud';

@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [RowActions, StatTile, AdminHeader, CommonModule, ReactiveFormsModule, Modal, Pager],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage {
  private branchService = inject(BranchService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  branches = signal<Branch[]>([]);
  pager = new Pagination(() => this.branches());
  private actions = new PageActions(() => this.load(true));
  saving = this.actions.saving;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateBranch));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditBranch));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteBranch));

  crud = new ModalCrud({
    actions: this.actions, noun: 'الفرع', plural: 'الفروع',
    titles: { create: 'إنشاء فرع جديد', edit: 'تعديل الفرع' },
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    forms: { create: this.createForm, edit: this.editForm },
    toEditValue: (b: Branch) => ({ name: b.name, description: b.description }),
    toBody: v => { const f = new FormData(); f.append('Name', v.name ?? ''); f.append('Description', v.description ?? ''); return f; },
    service: this.branchService
  });

  stats = computed(() => {
    const branches = this.branches();

    return {
      total: branches.length,
      withDescription: branches.filter(b => !!b.description).length,
      withoutDescription: branches.filter(b => !b.description).length
    };
  });

  /* =====================================================
   * Data loading
   * ===================================================== */
  private force = false;
  private data = loader(() => this.branchService.getAll(this.force), [] as Branch[], {
    onLoaded: branches => this.branches.set(branches),
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }

}
