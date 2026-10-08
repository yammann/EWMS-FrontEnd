import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VacationService } from '@core/services/vacation.service';
import { AuthService } from '@core/services/auth.service';
import { ApiService } from '@core/services/api.service';
import { User } from '@core/models/ewms.models';
import { VACATION_ATTACHMENTS, Vacation, VacationDaysPreview, VacationType } from '@core/models/vacation.models';
import { VacationAttachments, fileSize } from '@features/vacations/vacation-attachments';
import { daysAr, fridaysAr, holidaysAr } from '@core/utils/arabic-count';
import { AppPermission } from '@core/constants/access';
import { SignaturePanel } from './signature-panel';
import { formatPhone } from '@core/utils/phone';
import { utcDate } from '@core/models/maintenance.models';

export function vacationDateRange(control: AbstractControl) {
  const { startVac, endVac } = control.value;
  return startVac && endVac && endVac < startVac ? { dateRange: true } : null;
}

/** تاريخ اليوم المحلي بصيغة yyyy-MM-dd (قيمة حقل date) */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** لا تقديم بأثر رجعي، واليوم الحالي مسموح (قرار المستخدم 2026-10-04) */
export function notInPast(control: AbstractControl) {
  return control.value && control.value < localToday() ? { past: true } : null;
}

@Component({
  selector: 'app-profile-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SignaturePanel, VacationAttachments, Pager],
  templateUrl: './profile-page.html', styleUrl: '../shared/organization.scss'
})
export class ProfilePage {
  pager = new Pagination(() => this.vacations());
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
  canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintVacation));
  /** توقيعي الإلكتروني (يُحفظ مع قراراتي الموقَّعة ويُطبع على الأوراق): لمن يملك ManageMySignature */
  canSign = computed(() => this.auth.hasPermission(AppPermission.ManageMySignature));
  cancelling = signal<Vacation | null>(null);
  cancelSaving = signal(false);
  approved = computed(() => this.vacations().filter(v => v.status === 'Approved').length);
  pending = computed(() => this.vacations().filter(v => v.status.startsWith('Pending')).length);
  form = this.fb.nonNullable.group({
    vacationTypeId: [0, [Validators.required, Validators.min(1)]],
    startVac: ['', [Validators.required, notInPast]], endVac: ['', Validators.required],
    vacReason: ['', Validators.maxLength(500)]
  }, { validators: vacationDateRange });

  today = localToday();
  /** مرفقات الطلب الجديد: PDF أو JPG/PNG، حتى 3 × 5MB (يتحقق الباك أيضاً من محتوى الملف) */
  attachRules = VACATION_ATTACHMENTS;
  files = signal<File[]>([]);
  filesError = signal('');
  size = fileSize;
  addFiles(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? []);
    input.value = '';
    const rules = this.attachRules, problems: string[] = [];
    const ok = picked.filter(f => {
      if (!(rules.types as readonly string[]).includes(f.type)) { problems.push(`«${f.name}» ليس PDF أو صورة JPG/PNG`); return false; }
      if (f.size > rules.maxBytes) { problems.push(`«${f.name}» أكبر من 5MB`); return false; }
      if (!f.size) { problems.push(`«${f.name}» فارغ`); return false; }
      return true;
    });
    const all = [...this.files(), ...ok];
    if (all.length > rules.maxFiles) problems.push(`يمكن إرفاق ${rules.maxFiles} ملفات على الأكثر`);
    this.files.set(all.slice(0, rules.maxFiles));
    this.filesError.set(problems.join('، '));
  }
  removeFile(index: number) { this.files.update(list => list.filter((_, i) => i !== index)); this.filesError.set(''); }
  phone = formatPhone;
  utc = utcDate;
  /** معاينة أيام العمل في المدة المختارة (بلا جمعة ولا عطل رسمية) */
  preview = signal<VacationDaysPreview | null>(null);

  constructor() {
    this.loadProfile(); if (this.canViewVacations()) this.load();
    this.form.valueChanges.pipe(
      map(v => v.startVac && v.endVac && v.endVac >= v.startVac ? `${v.startVac}|${v.endVac}` : ''),
      distinctUntilChanged(), debounceTime(250),
      switchMap(key => {
        if (!key) return of(null);
        const [start, end] = key.split('|');
        return this.service.previewDays(start, end).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed()
    ).subscribe(p => this.preview.set(p));
  }
  previewText(p: VacationDaysPreview) {
    const skipped = [
      p.fridays ? fridaysAr(p.fridays) : '',
      p.holidays.length ? `${holidaysAr(p.holidays.length)} (${p.holidays.map(h => h.name).join('، ')})` : ''
    ].filter(Boolean).join(' و');
    return `أيام العمل في المدة: ${daysAr(p.workingDays)} من ${daysAr(p.calendarDays)}` + (skipped ? ` — لا يُحسب منها ${skipped}` : '');
  }
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
    this.service.create(this.form.getRawValue(), this.files()).subscribe({
      next: created => {
        this.saving.set(false); this.form.reset(); this.preview.set(null); this.files.set([]); this.filesError.set('');
        const v = created[0];
        this.success.set(v
          ? `تم تقديم طلب الإجازة رقم ${v.requestNumber} (أيام العمل: ${daysAr(v.vacDayCount)}). الحالة: ${v.statusAr}. يُحدَّد الدفع عند الاعتماد النهائي.`
          : 'تم تقديم طلب الإجازة');
        this.load();
      },
      error: e => { this.saving.set(false); this.submitError.set(e.message); }
    });
  }
}
