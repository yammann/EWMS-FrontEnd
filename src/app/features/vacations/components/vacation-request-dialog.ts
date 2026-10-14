import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { localDateInput } from '@core/utils/format';
import { fileSize } from '@core/utils/file-size';
import { daysAr, fridaysAr, holidaysAr } from '@core/utils/arabic-count';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { VacationService } from '../data-access/vacation.service';
import { VACATION_ATTACHMENTS, Vacation, VacationDaysPreview, VacationType } from '../data-access/vacation.models';
import { notInPast, vacationDateRange } from '../utils/vacation-validators';

/**
 * نافذة «تقديم طلب إجازة» (صفحة «إجازاتي»، 2026-10-13): النوع والمدة ومعاينة أيام العمل والسبب والمرفقات.
 * تُحسب المدة بأيام العمل (بلا الجمعة والعطل الرسمية)، ولا تقديم بأثر رجعي. تُطلق submitted بالطلب المقدَّم.
 */
@Component({
  selector: 'app-vacation-request-dialog', standalone: true, imports: [Modal, Alert, FormActions, ReactiveFormsModule, Icon],
  templateUrl: './vacation-request-dialog.html',
  styles: [`
    .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    @media (max-width: 560px) { .two { grid-template-columns: minmax(0, 1fr); } }
    .files { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .file-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border-radius: var(--radius-full); background: var(--fill); font-size: 12px; }
    .file-chip button { min-height: 24px; width: 24px; padding: 0; border-radius: 50%; }
    .note { margin: 0; font-size: 12.5px; color: var(--ink-500); line-height: 1.8; }
    .preview { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--brand-50); color: var(--brand-800); font-size: 13px; }
    .preview.empty { background: var(--warning-100); color: var(--warning-700); }
  `]
})
export class VacationRequestDialog {
  private service = inject(VacationService);

  submitted = output<Vacation>();
  closed = output<void>();

  types = signal<VacationType[]>([]);
  typesLoading = signal(true);
  typesError = signal('');
  saving = signal(false);
  error = signal('');
  preview = signal<VacationDaysPreview | null>(null);

  today = localDateInput();
  /** مرفقات الطلب: PDF أو JPG/PNG، حتى 3 × 5MB (يتحقق الخادم أيضاً من محتوى الملف) */
  attachRules = VACATION_ATTACHMENTS;
  files = signal<File[]>([]);
  filesError = signal('');
  size = fileSize;

  form = inject(FormBuilder).nonNullable.group({
    vacationTypeId: [0, [Validators.required, Validators.min(1)]],
    startVac: ['', [Validators.required, notInPast]], endVac: ['', Validators.required],
    vacReason: ['', Validators.maxLength(500)]
  }, { validators: vacationDateRange });

  constructor() {
    this.loadTypes();
    // معاينة أيام العمل في المدة المختارة (بلا جمعة ولا عطل رسمية)
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

  loadTypes() {
    this.typesLoading.set(true); this.typesError.set('');
    this.service.types().subscribe({
      next: value => { this.types.set(value); this.typesLoading.set(false); },
      error: e => { this.typesError.set(e.message); this.typesLoading.set(false); }
    });
  }

  previewText(p: VacationDaysPreview) {
    const skipped = [
      p.fridays ? fridaysAr(p.fridays) : '',
      p.holidays.length ? `${holidaysAr(p.holidays.length)} (${p.holidays.map(h => h.name).join('، ')})` : ''
    ].filter(Boolean).join(' و');
    return `أيام العمل في المدة: ${daysAr(p.workingDays)} من ${daysAr(p.calendarDays)}` + (skipped ? ` — لا يُحسب منها ${skipped}` : '');
  }

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

  /** لا يُرسل الطلب إن كانت المدة كلها عطلاً أو لا أنواع متاحة */
  blocked() {
    return this.form.invalid || this.saving() || this.typesLoading() || !!this.typesError() || !this.types().length || this.preview()?.workingDays === 0;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.blocked()) return;
    trackRequest(this.service.create(this.form.getRawValue(), this.files()), this.saving, this.error, created => this.submitted.emit(created[0]));
  }
}
