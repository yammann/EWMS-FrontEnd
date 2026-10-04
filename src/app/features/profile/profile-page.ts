import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VacationService } from '../../core/services/vacation.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/ewms.models';
import { Vacation, VacationType } from '../../core/models/vacation.models';
import { AppPermission } from '../../core/constants/access';
import { SignaturePanel } from './signature-panel';

export function vacationDateRange(control: AbstractControl) {
  const { startVac, endVac } = control.value;
  return startVac && endVac && endVac < startVac ? { dateRange: true } : null;
}

@Component({
  selector: 'app-profile-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SignaturePanel],
  templateUrl: './profile-page.html', styleUrl: '../shared/organization.scss'
})
export class ProfilePage {
  private service = inject(VacationService);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  user = inject(AuthService).currentUser;
  profile = signal<User | null>(null);
  profileError = signal('');
  vacations = signal<Vacation[]>([]);
  types = signal<VacationType[]>([]);
  loading = signal(false);
  typesLoading = signal(false);
  saving = signal(false);
  error = signal('');
  typesError = signal('');
  submitError = signal('');
  success = signal('');
  private auth = inject(AuthService);
  /** خدمة الإجازات قد لا تكون مُسندة لوحدة الموظف — عندها تختفي أقسامها من الملف */
  canViewVacations = computed(() => this.auth.hasPermission(AppPermission.ViewVacations));
  canRequest = computed(() => this.auth.hasPermission(AppPermission.CreateVacation));
  /** التوقيع الإلكتروني على ورقة تسليم طلبات الصيانة: لمن يملك SignMaintenanceReceipt */
  isManager = computed(() => this.auth.hasPermission(AppPermission.SignMaintenanceReceipt));
  cancelling = signal<Vacation | null>(null);
  cancelSaving = signal(false);
  approved = computed(() => this.vacations().filter(v => v.status === 'Approved').length);
  pending = computed(() => this.vacations().filter(v => v.status.startsWith('Pending')).length);
  form = this.fb.nonNullable.group({
    vacationTypeId: [0, [Validators.required, Validators.min(1)]],
    startVac: ['', Validators.required], endVac: ['', Validators.required],
    vacReason: ['', Validators.maxLength(500)]
  }, { validators: vacationDateRange });

  constructor() { this.loadProfile(); if (this.canViewVacations()) this.load(); }
  loadProfile() {
    this.profileError.set('');
    this.api.get<User>('/Auth/Me').subscribe({
      next: value => { this.profile.set(value); if (this.canRequest()) this.loadTypes(); },
      error: e => this.profileError.set(e.message)
    });
  }
  loadTypes() {
    this.typesLoading.set(true); this.typesError.set('');
    this.service.types().subscribe({
      next: value => { this.types.set(value); this.typesLoading.set(false); },
      error: e => { this.typesError.set(e.message); this.typesLoading.set(false); }
    });
  }
  load() {
    this.loading.set(true); this.error.set('');
    this.service.mine().subscribe({
      next: value => { this.vacations.set(value); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
  canCancel(v: Vacation) { return v.status === 'PendingManager' || v.status === 'PendingBranchManager'; }
  cancel(v: Vacation) {
    if (this.cancelSaving()) return;
    this.cancelSaving.set(true); this.error.set(''); this.success.set('');
    this.service.cancel(v.id).subscribe({
      next: r => { this.cancelSaving.set(false); this.cancelling.set(null); this.success.set(r.message); this.load(); },
      error: e => { this.cancelSaving.set(false); this.cancelling.set(null); this.submitError.set(e.message); }
    });
  }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || this.typesLoading() || this.typesError()) return;
    this.saving.set(true); this.submitError.set(''); this.success.set('');
    this.service.create(this.form.getRawValue()).subscribe({
      next: created => {
        this.saving.set(false); this.form.reset();
        // تجاوز حد الأيام المدفوعة (يومان شهرياً) يقسم الطلب إلى أكثر من إجازة
        const parts = created.map(v => `${v.vacDayCount} يوم ${v.paymentStatusAr}`).join(' + ');
        this.success.set(created.length > 1
          ? `تم تقديم الطلب وتقسيمه إلى ${created.length} طلبات: ${parts}. كل جزء يمر بمراحل الموافقة بشكل مستقل.`
          : `تم تقديم طلب الإجازة. الحالة: ${created[0]?.statusAr ?? ''}. ${parts}`);
        this.load();
      },
      error: e => { this.saving.set(false); this.submitError.set(e.message); }
    });
  }
}
