import { Signal, inject, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { ConfirmService } from './confirm.service';
import { PageActions } from './page-actions';
import { ToastService } from './toast.service';

export type CrudModal = 'create' | 'edit';

export interface ModalCrudConfig<T extends { id: number; name: string }, F extends FormGroup> {
  actions: PageActions;
  /** الاسم المعرَّف: «الفرع» — يُستعمل في رسائل النجاح والتأكيد */
  noun: string;
  /** الجمع: «الفروع» — لرسائل نقص الصلاحية */
  plural: string;
  titles: { create: string; edit: string };
  can: { create: Signal<boolean>; edit: Signal<boolean>; delete: Signal<boolean> };
  forms: { create: F; edit: F };
  /** قيم إعادة ضبط نموذج الإنشاء (افتراضياً reset() العادي) */
  createDefaults?: F['value'];
  /** قيم نموذج التعديل من السجل المحدد */
  toEditValue: (item: T) => F['value'];
  /** جسم الطلب (FormData) من قيم النموذج */
  toBody: (value: F['value']) => FormData;
  /** فحص إضافي قبل الإرسال: يعيد رسالة الخطأ أو null */
  validate?: (value: F['value']) => string | null;
  /** جملة تحذير إضافية في تأكيد الحذف، مثل «لا يمكن حذف مكتب مرتبط بموظفين» */
  deleteWarning?: string;
  service: {
    create(body: FormData): Observable<unknown>;
    update(id: number, body: FormData): Observable<unknown>;
    delete(id: number): Observable<unknown>;
  };
}

/**
 * منطق صفحات الإدارة ذات النافذة المنبثقة (إنشاء/تعديل/حذف): فتح النافذة بحسب الصلاحية، التحقق، الإرسال عبر PageActions،
 * وتأكيد الحذف. تُنشأ كحقل في المكوّن بعد تعريف النموذجين: `crud = new ModalCrud<Branch, typeof this.createForm>({...})`.
 */
export class ModalCrud<T extends { id: number; name: string }, F extends FormGroup> {
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly selected = signal<T | null>(null);
  readonly activeModal = signal<CrudModal | null>(null);

  constructor(private cfg: ModalCrudConfig<T, F>) {}

  private deny(verb: string) { this.toast.show(`لا تملك صلاحية ${verb} ${this.cfg.plural}`, 'error'); }

  openCreate() {
    if (!this.cfg.can.create()) return this.deny('إضافة');
    this.selected.set(null);
    this.cfg.forms.create.reset(this.cfg.createDefaults);
    this.activeModal.set('create');
  }

  openEdit(item: T) {
    if (!this.cfg.can.edit()) return this.deny('تعديل');
    this.selected.set(item);
    this.cfg.forms.edit.patchValue(this.cfg.toEditValue(item));
    this.activeModal.set('edit');
  }

  closeModal() { this.activeModal.set(null); }

  modalTitle(type: CrudModal) { return this.cfg.titles[type]; }

  create() {
    const form = this.cfg.forms.create;
    if (form.invalid) return;
    const value = form.getRawValue();
    const problem = this.cfg.validate?.(value);
    if (problem) { this.toast.show(problem, 'error'); return; }
    this.cfg.actions.run('create', this.cfg.service.create(this.cfg.toBody(value)), `تم إنشاء ${this.cfg.noun} بنجاح`, () => {
      form.reset(this.cfg.createDefaults);
      this.closeModal();
    });
  }

  update() {
    const item = this.selected();
    const form = this.cfg.forms.edit;
    if (!item || form.invalid) return;
    const value = form.getRawValue();
    const problem = this.cfg.validate?.(value);
    if (problem) { this.toast.show(problem, 'error'); return; }
    this.cfg.actions.run('edit', this.cfg.service.update(item.id, this.cfg.toBody(value)), `تم تعديل ${this.cfg.noun} بنجاح`, () => this.closeModal());
  }

  async remove(item: T) {
    if (!this.cfg.can.delete()) return this.deny('حذف');
    const tail = this.cfg.deleteWarning ? `${this.cfg.deleteWarning}، ولا يمكن التراجع عن هذا الإجراء.` : 'لا يمكن التراجع عن هذا الإجراء.';
    if (!await this.confirm.ask(`هل أنت متأكد من حذف ${this.cfg.noun} "${item.name}"؟ ${tail}`, 'تأكيد الحذف')) return;
    this.cfg.actions.run(`delete-${item.id}`, this.cfg.service.delete(item.id), `تم حذف ${this.cfg.noun} بنجاح`, () => {
      if (this.selected()?.id === item.id) this.selected.set(null);
    });
  }
}
