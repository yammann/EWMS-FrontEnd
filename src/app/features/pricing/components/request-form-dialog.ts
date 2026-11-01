import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { ContractsService, type ContractItem } from '@features/contracts';
import { ProjectsService } from '@features/projects';
import type { ProjectResponseDto } from '@core/api/api-types';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { PricingRequest, PricingRequestInput } from '../data-access/pricing.models';
import { PricingService } from '../data-access/pricing.service';

interface ItemRow { description: string; specifications: string; quantity: number | null; unit: string; }

const day = (v: string | null | undefined) => v?.slice(0, 10) ?? '';

/**
 * نموذج طلب التسعير (تسجيل وتعديل): العنوان والموعد والبنود، وربطه اختيارياً بمشروع يراه المستخدم وبعقد المشروع،
 * أو «خارج نطاق العقد». البنود تتجمّد بعد أول عرض (الخادم يرفض تغييرها، وهنا تُعرض للقراءة فقط).
 */
@Component({
  selector: 'app-pricing-request-form-dialog', standalone: true,
  imports: [FormsModule, Alert, Modal],
  styles: [`
    .item-row { display: grid; grid-template-columns: 1.6fr 1.2fr 90px 100px auto; gap: 8px; align-items: center; margin-bottom: 8px; }
    @media (max-width: 640px) { .item-row { grid-template-columns: 1fr; } }
  `],
  template: `
    <app-modal [heading]="request() ? 'تعديل طلب التسعير' : 'طلب تسعير جديد'" [subheading]="request()?.number ?? ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="submit()">
        <div class="modal-body form-stack">
          <app-alert [message]="localError() || error()" />
          <label class="form-field"><span class="form-label">العنوان</span><input name="t" [(ngModel)]="title" maxlength="200" autocomplete="off"></label>
          <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea name="d" [(ngModel)]="description" rows="2" maxlength="2000"></textarea></label>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الموعد المطلوب <small class="hint">(اختياري — تجاوزه تنبيه لا قرار)</small></span><input name="due" type="date" [(ngModel)]="dueDate"></label>
            <label class="form-field check"><input name="out" type="checkbox" [(ngModel)]="outside"> أعمال أو مواد خارج نطاق العقد</label>
          </div>
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">المشروع <small class="hint">(اختياري)</small></span>
              <select name="p" [ngModel]="projectId()" (ngModelChange)="pickProject($event)" [disabled]="!!request()">
                <option [ngValue]="null">بلا مشروع</option>
                @for (p of projectList(); track p.id) { <option [ngValue]="p.id">{{ p.number }} — {{ p.name }}</option> }
              </select></label>
            @if (projectId()) {
              <label class="form-field"><span class="form-label">العقد <small class="hint">(اختياري)</small></span>
                <select name="c" [(ngModel)]="contractId" [disabled]="!!request()"><option [ngValue]="null">بلا عقد</option>@for (c of contracts(); track c.id) { <option [ngValue]="c.id">{{ c.number }}@if (c.contractorName) { — {{ c.contractorName }} }</option> }</select></label>
            } @else if (canChooseBranch() && !request()) {
              <label class="form-field"><span class="form-label">الفرع</span>
                <select name="b" [(ngModel)]="branchId"><option [ngValue]="null">فرعي</option>@for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }</select></label>
            }
          </div>

          <div class="form-field"><span class="form-label">البنود <small class="hint">(وحدة كل بند تُحدّد ما يُقارَن بها؛ لا مقارنة بين وحدات مختلفة)</small></span>
            @if (frozen()) { <p class="hint">البنود مجمَّدة لوجود عروض مسجَّلة عليها.</p> }
            @for (r of rows; track $index) {
              <div class="item-row">
                <input [name]="'d' + $index" [(ngModel)]="r.description" placeholder="وصف البند" maxlength="300" [disabled]="frozen()">
                <input [name]="'s' + $index" [(ngModel)]="r.specifications" placeholder="المواصفات (اختياري)" maxlength="1000" [disabled]="frozen()">
                <input [name]="'q' + $index" type="number" min="0" step="any" [(ngModel)]="r.quantity" placeholder="الكمية" [disabled]="frozen()">
                <input [name]="'u' + $index" [(ngModel)]="r.unit" placeholder="الوحدة" maxlength="30" [disabled]="frozen()">
                <button type="button" class="btn btn-ghost btn-sm" (click)="removeRow($index)" [disabled]="frozen() || rows.length < 2">حذف</button>
              </div>
            }
            @if (!frozen()) { <button type="button" class="btn btn-ghost btn-sm" (click)="addRow()">+ بند</button> }
          </div>
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button><button type="submit" [disabled]="busy()">{{ request() ? 'حفظ' : 'تسجيل الطلب' }}</button></footer>
      </form>
    </app-modal>`
})
export class RequestFormDialog {
  private service = inject(PricingService);
  private projects = inject(ProjectsService);
  private contractsService = inject(ContractsService);
  private lookups = inject(LookupsService);

  request = input<PricingRequest | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<PricingRequestInput>();
  closed = output<void>();

  title = ''; description = ''; dueDate = ''; outside = false;
  contractId: number | null = null; branchId: number | null = null;
  rows: ItemRow[] = [{ description: '', specifications: '', quantity: null, unit: '' }];

  projectId = signal<number | null>(null);
  projectList = signal<ProjectResponseDto[]>([]);
  contracts = signal<ContractItem[]>([]);
  branches = signal<Branch[]>([]);
  localError = signal('');
  canChooseBranch = computed(() => this.service.access().canChooseBranch);
  /** بعد أول عرض لا تتغير البنود (الخادم يرفض ذلك أيضاً) */
  frozen = computed(() => !!this.request() && !this.request()!.canEditItems);

  constructor() {
    effect(() => {
      const r = this.request();
      if (!r) return;
      this.title = r.title; this.description = r.description; this.dueDate = day(r.dueDate); this.outside = r.outsideContractScope;
      this.projectId.set(r.projectId); this.contractId = r.contractId;
      this.rows = r.items.map(i => ({ description: i.description, specifications: i.specifications, quantity: i.quantity, unit: i.unit }));
      if (r.projectId) this.loadContracts(r.projectId);
    });
    // المشاريع التي يراها المستخدم (قد لا يملك «عرض المشاريع»: يبقى الطلب بلا مشروع)
    this.projects.search({ search: '', branchId: null, departmentId: null, siteId: null, stage: null, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.projectList.set(page.items as ProjectResponseDto[]), error: () => this.projectList.set([]) });
    if (this.service.access().canChooseBranch) this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  private loadContracts(projectId: number) {
    this.contractsService.search({ projectId, status: null, method: null, contractorId: null, search: '', warrantyEndingOnly: false, page: 1, pageSize: 100 })
      .subscribe({ next: page => this.contracts.set(page.items), error: () => this.contracts.set([]) });
  }

  pickProject(id: number | null) {
    this.projectId.set(id); this.contractId = null; this.contracts.set([]);
    if (id) this.loadContracts(id);
  }

  addRow() { this.rows = [...this.rows, { description: '', specifications: '', quantity: null, unit: '' }]; }
  removeRow(i: number) { this.rows = this.rows.filter((_, k) => k !== i); }

  submit() {
    this.localError.set('');
    if (!this.title.trim()) { this.localError.set('اكتب عنوان الطلب'); return; }
    const bad = this.rows.findIndex(r => !r.description.trim() || !r.unit.trim() || !r.quantity || r.quantity <= 0);
    if (bad >= 0) { this.localError.set(`البند ${bad + 1}: الوصف والوحدة وكمية أكبر من صفر مطلوبة`); return; }
    const r = this.request();
    this.submitted.emit({
      title: this.title.trim(), description: this.description.trim() || null, dueDate: this.dueDate || null, outsideContractScope: this.outside,
      projectId: this.projectId(), contractId: this.projectId() ? this.contractId : null, correspondenceId: r?.correspondenceId ?? null,
      branchId: this.projectId() || r ? null : this.branchId,
      items: this.rows.map(x => ({ description: x.description.trim(), specifications: x.specifications.trim() || null, quantity: x.quantity!, unit: x.unit.trim() })),
      rowVersion: r?.rowVersion ?? null
    });
  }
}
