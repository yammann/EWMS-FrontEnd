import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { Correspondence, ReferInput, ReferralDepartment, ReferralUser } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

/**
 * إحالة معاملة إلى قسم من فرعها (ومعه مكتب وموظف اختياريان). الموظف يُختار ممّن يملك صلاحية المعالجة في الجهة.
 * الإحالة لا تفتح المعاملة لكل موظفي القسم: يراها ويعالجها حاملو المعالجة فيه والموظف المسمّى.
 */
@Component({
  selector: 'app-refer-dialog', standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, SelectValue],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal heading="إحالة المعاملة" [subheading]="(item().number || 'مسودة') + ' — ' + item().subject" size="md" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || loadError()" />

          <label class="form-field"><span class="form-label">القسم</span>
            <select #d [appSelectValue]="form.controls.departmentId.value" (change)="pickDepartment(+d.value)">
              <option value="0">اختر القسم</option>
              @for (dep of departments(); track dep.id) { <option [value]="dep.id">{{ dep.name }}</option> }
            </select>
            @if (form.controls.departmentId.touched && !form.controls.departmentId.value) { <small class="form-error">اختر القسم المحال إليه</small> }
          </label>

          @if (offices().length) {
            <label class="form-field"><span class="form-label">المكتب <small class="hint">(اختياري)</small></span>
              <select #o [appSelectValue]="form.controls.officeId.value" (change)="pickOffice(+o.value)">
                <option value="0">القسم نفسه (بلا مكتب)</option>
                @for (of of offices(); track of.id) { <option [value]="of.id">{{ of.name }}</option> }
              </select></label>
          }

          @if (form.controls.departmentId.value) {
            <label class="form-field"><span class="form-label">موظف بعينه <small class="hint">(اختياري — يملك صلاحية المعالجة)</small></span>
              <select #u [appSelectValue]="form.controls.userId.value" (change)="form.controls.userId.setValue(+u.value)">
                <option value="0">كل من يعالج في هذه الجهة</option>
                @for (usr of users(); track usr.id) { <option [value]="usr.id">{{ usr.fullName }}{{ usr.officeName ? ' — ' + usr.officeName : '' }}</option> }
              </select></label>
          }

          <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span>
            <textarea formControlName="note" rows="3" maxlength="1000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الإحالة…' : 'إحالة' }}</button>
        </footer>
      </form>
    </app-modal>
  `
})
export class ReferDialog implements OnInit {
  private service = inject(DiwanService);

  item = input.required<Correspondence>();
  busy = input(false);
  error = input('');
  submitted = output<ReferInput>();
  closed = output<void>();

  departments = signal<ReferralDepartment[]>([]);
  offices = signal<{ id: number; name: string }[]>([]);
  users = signal<ReferralUser[]>([]);
  loadError = signal('');

  form = inject(FormBuilder).nonNullable.group({ departmentId: [0], officeId: [0], userId: [0], note: [''] });

  ngOnInit() {
    this.service.referralTargets(this.item().branchId).subscribe({
      next: d => this.departments.set(d),
      error: e => this.loadError.set(e.message)
    });
  }

  pickDepartment(id: number) {
    this.form.patchValue({ departmentId: id, officeId: 0, userId: 0 });
    this.offices.set(this.departments().find(d => d.id === id)?.offices ?? []);
    this.loadUsers();
  }

  pickOffice(id: number) {
    this.form.patchValue({ officeId: id, userId: 0 });
    this.loadUsers();
  }

  private loadUsers() {
    const { departmentId, officeId } = this.form.getRawValue();
    this.users.set([]);
    if (!departmentId) return;
    this.service.referralUsers(departmentId, officeId || null).subscribe({ next: u => this.users.set(u), error: () => this.users.set([]) });
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (!v.departmentId || this.busy()) return;
    this.submitted.emit({ toDepartmentId: v.departmentId, toOfficeId: v.officeId || null, toUserId: v.userId || null, note: v.note.trim() });
  }
}
