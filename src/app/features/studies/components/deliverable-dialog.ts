import { Component, OnInit, computed, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import type { ProjectMember } from '@features/projects';
import { DeliverableInput, DeliverableType, Study, StudyDeliverable } from '../data-access/studies.models';

/**
 * إضافة مخرج فني إلى أمر الدراسة أو تعديله: النوع (يعرّفه الفرع)، والمهندس المسؤول من مشاركي المشروع، والموعد والملاحظة،
 * وموضعه في التسلسل إن كان الأمر بالتسلسل. النوع الواحد مرة واحدة لكل أمر، ولا يتغير نوع مخرج بدأ العمل عليه (الخادم يفرض ذلك).
 */
@Component({
  selector: 'app-deliverable-dialog', standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, SelectValue],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="deliverable() ? 'تعديل المخرج' : 'إضافة مخرج'" [subheading]="study().number + ' — ' + study().title" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />

          <label class="form-field"><span class="form-label">نوع المخرج</span>
            <select #t [appSelectValue]="form.controls.typeId.value" (change)="form.controls.typeId.setValue(+t.value)">
              <option value="0">اختر النوع</option>
              @for (ty of typeOptions(); track ty.id) { <option [value]="ty.id">{{ ty.name }}</option> }
            </select>
            @if (form.controls.typeId.touched && !form.controls.typeId.value) { <small class="form-error">اختر نوع المخرج</small> }
            @if (!typeOptions().length) { <small class="hint">لا أنواع متاحة: أضيفت كلها إلى الأمر، أو لم يعرّف الفرع أنواعاً بعد.</small> }
          </label>

          <label class="form-field"><span class="form-label">المهندس المسؤول <small class="hint">(من مشاركي المشروع)</small></span>
            <select #a [appSelectValue]="form.controls.assigneeUserId.value" (change)="form.controls.assigneeUserId.setValue(+a.value)">
              <option value="0">غير مسند بعد</option>
              @for (m of members(); track m.userId) { <option [value]="m.userId">{{ m.fullName }}{{ m.departmentName ? ' — ' + m.departmentName : '' }}</option> }
            </select>
            @if (!members().length) { <small class="hint">لا مشاركون في المشروع: أضف المهندس من تبويب «المشاركون» أولاً.</small> }
          </label>

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الموعد <small class="hint">(اختياري)</small></span>
              <input type="date" formControlName="dueDate"></label>
            @if (study().mode === 1) {
              <label class="form-field"><span class="form-label">الترتيب في التسلسل</span>
                <input type="number" min="1" max="1000" formControlName="sortOrder"></label>
            }
          </div>

          <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span>
            <textarea formControlName="note" rows="2" maxlength="1000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : deliverable() ? 'حفظ' : 'إضافة' }}</button>
        </footer>
      </form>
    </app-modal>`
})
export class DeliverableDialog implements OnInit {
  private fb = inject(FormBuilder);

  study = input.required<Study>();
  /** التعديل: المخرج نفسه */
  deliverable = input<StudyDeliverable | null>(null);
  types = input<DeliverableType[]>([]);
  members = input<ProjectMember[]>([]);
  busy = input(false);
  error = input('');
  submitted = output<DeliverableInput>();
  closed = output<void>();

  form = this.fb.nonNullable.group({
    typeId: [0, [Validators.required, Validators.min(1)]],
    assigneeUserId: [0],
    dueDate: [''],
    sortOrder: [1],
    note: ['']
  });

  /** الأنواع الفعّالة غير المستعملة في الأمر (يبقى نوع المخرج الحالي عند التعديل) */
  typeOptions = computed(() => {
    const used = new Set(this.study().deliverables.map(d => d.typeId));
    const own = this.deliverable()?.typeId;
    return this.types().filter(t => (t.isActive && !used.has(t.id)) || t.id === own);
  });

  ngOnInit() {
    const d = this.deliverable();
    if (d) {
      this.form.patchValue({ typeId: d.typeId, assigneeUserId: d.assigneeUserId ?? 0, dueDate: d.dueDate?.slice(0, 10) ?? '', sortOrder: d.sortOrder, note: d.note });
    } else {
      this.form.patchValue({ sortOrder: this.study().deliverables.length + 1 });
    }
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      typeId: v.typeId, officeId: this.deliverable()?.officeId ?? null, assigneeUserId: v.assigneeUserId || null, dueDate: v.dueDate || null,
      note: v.note.trim() || null, sortOrder: this.study().mode === 1 ? Number(v.sortOrder) || null : null, rowVersion: this.deliverable()?.rowVersion ?? null
    });
  }
}
