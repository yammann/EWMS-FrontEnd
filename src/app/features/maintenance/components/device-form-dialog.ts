import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceDevice, MaintenanceLookup } from '../data-access/maintenance.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/** مقارنة الرقمين بعد حذف الفراغات وبلا تمييز لحالة الأحرف (الباكاند يعامل الرقم كذلك) */
const sameSerial = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * إضافة جهاز صيانة أو تعديله (قرار المستخدم 2026-10-05): الرقم التسلسلي مطلوب ويُكتب مرتين يدوياً
 * (حقل تأكيد)، والنسخ واللصق والسحب معطّلة في الحقلين كي لا يُنقل خطأ الكتابة إلى التأكيد.
 * عند التعديل يُطلب التأكيد فقط إن تغيّر الرقم.
 */
@Component({
  selector: 'app-device-form-dialog', standalone: true, imports: [Alert, ReactiveFormsModule, Modal],
  styleUrl: '../../../shared/styles/devices.scss',
  templateUrl: './device-form-dialog.html',
  styles: [`
    .hint-line { margin: -6px 0 0; font-size: 12px; color: var(--ink-500); }
  `]
})
export class DeviceFormDialog implements OnInit {
  private service = inject(MaintenanceService);

  /** null = جهاز جديد */
  device = input<MaintenanceDevice | null>(null);
  /** رقم تسلسلي مقترح لجهاز جديد (من البحث في نموذج الطلب) — يبقى التأكيد مطلوباً بالكتابة */
  initialSerial = input('');
  lookups = input.required<{ deviceTypes: MaintenanceLookup[]; companies: MaintenanceLookup[] }>();
  saved = output<MaintenanceDevice>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  pasteBlocked = signal(false);

  form = inject(FormBuilder).nonNullable.group({
    serialNumber: ['', [Validators.required, Validators.maxLength(100), (c: AbstractControl<string>) => c.value.trim() ? null : { required: true }]],
    serialConfirm: [''],
    name: ['', Validators.maxLength(200)],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(1000)],
    deviceTypeId: [0, Validators.min(1)],
    deviceCompanyId: [0, Validators.min(1)]
  }, { validators: (g: AbstractControl): ValidationErrors | null => this.confirmError(g) });

  ngOnInit() {
    const d = this.device();
    this.form.reset({
      serialNumber: d?.serialNumber ?? this.initialSerial(), serialConfirm: '',
      name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '',
      deviceTypeId: d?.deviceTypeId ?? 0, deviceCompanyId: d?.deviceCompanyId ?? 0
    });
  }

  /** التأكيد مطلوب لجهاز جديد، أو عند تغيير رقم جهاز موجود */
  needsConfirm() {
    const d = this.device();
    return !d || !sameSerial(this.form.controls.serialNumber.value, d.serialNumber);
  }

  private confirmError(g: AbstractControl): ValidationErrors | null {
    if (!this.form || !this.needsConfirm()) return null;
    const { serialNumber, serialConfirm } = g.getRawValue();
    return serialNumber.trim() && sameSerial(serialNumber, serialConfirm) ? null : { serialMismatch: true };
  }

  block(event: Event) {
    event.preventDefault();
    if (event.type !== 'contextmenu') this.pasteBlocked.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      serialNumber: v.serialNumber.trim(), name: v.name.trim(), model: v.model.trim(), description: v.description.trim(),
      deviceTypeId: v.deviceTypeId, deviceCompanyId: v.deviceCompanyId
    };
    const d = this.device();
    trackRequest((d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)), this.saving, this.error, result => { this.saved.emit(result); });
  }
}
