import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { Correspondence, CorrespondenceItem, CorrespondenceType, ProjectOption } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

export type RegisterMode = 'incoming' | 'draft' | 'edit';

/** ما يخرجه النموذج؛ الصفحة تحوّله إلى طلب تسجيل أو مسودة أو تعديل بحسب الوضع */
export interface RegisterPayload {
  branchId: number | null;
  typeId: number;
  party: string;
  subject: string;
  summary: string;
  externalNumber: string;
  externalDate: string | null;
  projectId: number | null;
  replyToId: number | null;
}

/**
 * تسجيل وارد، أو إعداد مسودة صادر، أو تعديل بيانات معاملة. الفرع يُختار عند الإنشاء لنظرة المؤسسة فقط (غيرها فرعه) ويُحمَّل نوع المعاملة
 * من فرعه؛ المشروع اختياري (يُربَط لاحقاً أيضاً). مهلة النوع تُحسب منها مهلة الوارد، فتُعرض بجانب اسمه.
 */
@Component({
  selector: 'app-register-dialog', standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, SelectValue],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (loadError()) { <p class="alert alert-warning" role="status">{{ loadError() }}</p> }

          <div class="form-grid-2">
            @if (mode() !== 'edit' && access().canChooseBranch) {
              <label class="form-field"><span class="form-label">الفرع</span>
                <select #b [appSelectValue]="form.controls.branchId.value" (change)="changeBranch(+b.value)">
                  <option value="0">اختر الفرع</option>
                  @for (br of branches(); track br.id) { <option [value]="br.id">{{ br.name }}</option> }
                </select></label>
            }
            <label class="form-field"><span class="form-label">نوع المعاملة</span>
              <select #t [appSelectValue]="form.controls.typeId.value" (change)="form.controls.typeId.setValue(+t.value)">
                <option value="0">اختر النوع</option>
                @for (ty of types(); track ty.id) { <option [value]="ty.id">{{ ty.name }}{{ ty.deadlineDays ? ' — مهلة ' + ty.deadlineDays + ' يوماً' : '' }}</option> }
              </select>
              @if (form.controls.typeId.touched && !form.controls.typeId.value) { <small class="form-error">اختر نوع المعاملة</small> }
            </label>
          </div>

          <label class="form-field"><span class="form-label">{{ mode() === 'draft' || item()?.direction === 2 ? 'المرسَل إليه' : 'الجهة المرسِلة' }}</span>
            <input formControlName="party" maxlength="200" autocomplete="off">
            @if (form.controls.party.touched && form.controls.party.invalid) { <small class="form-error">الجهة مطلوبة</small> }
          </label>

          <label class="form-field"><span class="form-label">الموضوع</span>
            <input formControlName="subject" maxlength="300" autocomplete="off">
            @if (form.controls.subject.touched && form.controls.subject.invalid) { <small class="form-error">الموضوع مطلوب</small> }
          </label>

          <label class="form-field"><span class="form-label">{{ mode() === 'draft' || item()?.direction === 2 ? 'نص الكتاب' : 'ملخص المعاملة' }} <small class="hint">(اختياري)</small></span>
            <textarea formControlName="summary" rows="4" maxlength="4000"></textarea></label>

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">رقم الكتاب <small class="hint">(عند الجهة، اختياري)</small></span>
              <input formControlName="externalNumber" dir="ltr" maxlength="50" autocomplete="off"></label>
            @if (mode() === 'incoming' || item()?.direction === 1) {
              <label class="form-field"><span class="form-label">تاريخ الكتاب <small class="hint">(اختياري)</small></span>
                <input type="date" formControlName="externalDate"></label>
            }
            @if (access().canListProjects) {
              <label class="form-field"><span class="form-label">المشروع <small class="hint">(اختياري)</small></span>
                <select #p [appSelectValue]="form.controls.projectId.value" (change)="form.controls.projectId.setValue(+p.value)">
                  <option value="0">بلا مشروع</option>
                  @for (pr of projects(); track pr.id) { <option [value]="pr.id">{{ pr.number }} — {{ pr.name }}</option> }
                </select></label>
            }
          </div>

          @if (replyTo(); as r) {
            <p class="alert alert-info" role="status">ردّ على المعاملة <span dir="ltr">{{ r.number }}</span> — {{ r.subject }}</p>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : submitLabel() }}</button>
        </footer>
      </form>
    </app-modal>
  `
})
export class RegisterDialog implements OnInit {
  private service = inject(DiwanService);
  private lookups = inject(LookupsService);

  mode = input.required<RegisterMode>();
  /** وضع التعديل: المعاملة المعدَّلة */
  item = input<Correspondence | null>(null);
  /** مسودة ردّ على وارد */
  replyTo = input<CorrespondenceItem | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<RegisterPayload>();
  closed = output<void>();

  access = this.service.access;
  branches = signal<Branch[]>([]);
  types = signal<CorrespondenceType[]>([]);
  projects = signal<ProjectOption[]>([]);
  loadError = signal('');

  form = inject(FormBuilder).nonNullable.group({
    branchId: [0],
    typeId: [0, Validators.min(1)],
    party: ['', [Validators.required, Validators.maxLength(200)]],
    subject: ['', [Validators.required, Validators.maxLength(300)]],
    summary: ['', Validators.maxLength(4000)],
    externalNumber: ['', Validators.maxLength(50)],
    externalDate: [''],
    projectId: [0]
  });

  heading = () => this.mode() === 'incoming' ? 'تسجيل معاملة واردة' : this.mode() === 'draft' ? 'مسودة كتاب صادر' : 'تعديل المعاملة';
  subheading = () => this.mode() === 'edit' ? (this.item()?.number ?? 'مسودة') : this.mode() === 'draft'
    ? 'بلا رقم حتى الصدور: أرفق نص الكتاب ثم ارفعها للاعتماد' : 'تأخذ رقمها الداخلي، وتبقى عند وحدتك إلى أن تحيلها';
  submitLabel = () => this.mode() === 'edit' ? 'حفظ التعديلات' : this.mode() === 'draft' ? 'حفظ المسودة' : 'تسجيل المعاملة';

  ngOnInit() {
    const c = this.item();
    if (c) {
      this.form.reset({
        branchId: c.branchId, typeId: c.typeId, party: c.party, subject: c.subject, summary: c.summary, externalNumber: c.externalNumber ?? '',
        externalDate: c.externalDate ? c.externalDate.slice(0, 10) : '', projectId: c.projectId ?? 0
      });
    }
    if (this.mode() !== 'edit' && this.access().canChooseBranch) {
      this.lookups.branchOptions().subscribe({ next: b => this.branches.set(b), error: () => this.loadError.set('تعذّر تحميل الفروع') });
    } else {
      this.loadTypes(c?.branchId ?? null);
    }
    if (this.access().canListProjects) {
      this.service.projects().subscribe({ next: p => this.projects.set(p), error: () => this.projects.set([]) });
    }
  }

  changeBranch(branchId: number) {
    this.form.controls.branchId.setValue(branchId);
    this.form.controls.typeId.setValue(0);
    this.types.set([]);
    if (branchId) this.loadTypes(branchId);
  }

  private loadTypes(branchId: number | null) {
    this.service.types(branchId).subscribe({
      next: t => this.types.set(t.filter(x => x.isActive || x.id === this.item()?.typeId)),
      error: () => this.loadError.set('تعذّر تحميل أنواع المعاملات: تلزم صلاحية عرض أنواع الديوان')
    });
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || this.busy()) return;
    this.submitted.emit({
      branchId: this.mode() !== 'edit' && this.access().canChooseBranch && v.branchId ? v.branchId : null,
      typeId: v.typeId,
      party: v.party.trim(),
      subject: v.subject.trim(),
      summary: v.summary.trim(),
      externalNumber: v.externalNumber.trim(),
      externalDate: v.externalDate || null,
      projectId: v.projectId || null,
      replyToId: this.replyTo()?.id ?? this.item()?.replyToId ?? null
    });
  }
}
