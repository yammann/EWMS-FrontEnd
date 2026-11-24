import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { EMPTY, Subject, catchError, map, merge, startWith, switchMap, timer } from 'rxjs';
import { orEmpty } from '@core/http/or-empty';
import { Department } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { PRIORITIES, StudyAssignment, StudyAssignmentInput } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

/** الطلب الذي يُصدر له التكليف (من صفحة الطلب، أو من التكليف نفسه عند التعديل) */
export interface AssignmentParent {
  requestId: number; requestNumber: string; mainBeneficiary: string; branchId: number; adminArchiveNumber: string | null;
}

const deadlineAfterReferral = (g: AbstractControl): ValidationErrors | null => {
  const { referralDate, responseDeadline } = g.getRawValue() as { referralDate: string; responseDeadline: string };
  return referralDate && responseDeadline && responseDeadline < referralDate ? { deadline: true } : null;
};

/**
 * التكليف الداخلي (IPA) لطلب معتمد — حقول النموذج الورقي: القسم المتابع، الكود، الميزانية، ملخص النطاق،
 * المخرجات المطلوبة، تاريخ الإحالة والحد الأقصى للرد، ودرجة الأهمية. يوقّعه رئيس الفرع بعد الإرسال.
 */
@Component({
  selector: 'app-study-assignment-form-dialog',
  standalone: true,
  imports: [SearchSelect, SelectOption, ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  templateUrl: './assignment-form-dialog.html'
})
export class StudyAssignmentFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private lookups = inject(LookupsService);
  private destroyRef = inject(DestroyRef);
  private previewRetry = new Subject<void>();

  parent = input.required<AssignmentParent>();
  /** null = تكليف جديد */
  assignment = input<StudyAssignment | null>(null);
  saved = output<StudyAssignment>();
  closed = output<void>();

  priorities = PRIORITIES;
  saving = signal(false);
  error = signal('');
  missing = signal('');
  departments = signal<Department[]>([]);
  projectCode = signal('');
  previewError = signal('');
  previewLoading = signal(false);
  needsArchiveNumber = computed(() => !this.assignment() && !this.parent().adminArchiveNumber?.trim());

  form = inject(FormBuilder).nonNullable.group({
    followingDepartmentId: [0, Validators.min(1)],
    assignmentDate: [localDateInput(), Validators.required],
    adminArchiveNumber: ['', Validators.maxLength(50)],
    allocatedBudget: [null as number | null, Validators.min(0)],
    scopeSummary: ['', [Validators.required, Validators.maxLength(4000)]],
    needsTechnicalEvaluation: [true],
    needsResourceEstimate: [true],
    needsPreliminaryBudget: [true],
    needsFinalRecommendation: [true],
    referralDate: [localDateInput(), Validators.required],
    responseDeadline: ['', Validators.required],
    priority: [3, Validators.required]
  }, { validators: deadlineAfterReferral });

  ngOnInit() {
    const a = this.assignment();
    if (a) {
      this.projectCode.set(a.projectCode ?? '');
      this.form.reset({
        followingDepartmentId: a.followingDepartmentId, assignmentDate: dateOnly(a.assignmentDate),
        allocatedBudget: a.allocatedBudget, scopeSummary: a.scopeSummary,
        needsTechnicalEvaluation: a.needsTechnicalEvaluation, needsResourceEstimate: a.needsResourceEstimate,
        needsPreliminaryBudget: a.needsPreliminaryBudget, needsFinalRecommendation: a.needsFinalRecommendation,
        referralDate: dateOnly(a.referralDate), responseDeadline: dateOnly(a.responseDeadline), priority: a.priority
      });
    }
    // في التعديل أيضاً: يتبع الكود سنة التكليف، فيعيد الخادم توليده عند تغيير التاريخ.
    this.watchProjectCode();
    // القسم المتابع من أقسام فرع الطلب (يرفض الخادم غيرها)
    const branchId = this.parent().branchId;
    this.lookups.departments().pipe(
      map(list => list.filter(d => d.branchId === branchId)),
      orEmpty(() => this.missing.set('تعذّر تحميل الأقسام — تحتاج صلاحية «عرض الأقسام».'))
    ).subscribe(list => this.departments.set(list));
  }

  retryProjectCode() { this.previewRetry.next(); }

  private watchProjectCode() {
    const { assignmentDate, adminArchiveNumber } = this.form.controls;
    const editing = this.assignment();
    const changes = merge(assignmentDate.valueChanges, adminArchiveNumber.valueChanges, this.previewRetry);
    // التعديل يعرض الكود المحفوظ أولاً ولا يطلب المعاينة إلا بعد تغيير التاريخ
    (editing ? changes : changes.pipe(startWith(null))).pipe(
      switchMap(() => {
        const archive = adminArchiveNumber.value.trim();
        this.projectCode.set('');
        this.previewError.set('');
        const ready = assignmentDate.valid && (!this.needsArchiveNumber() || (!!archive && adminArchiveNumber.valid));
        this.previewLoading.set(ready);
        if (!ready) return EMPTY;
        const date = assignmentDate.value;
        return timer(200).pipe(
          switchMap(() => this.service.previewProjectCode(this.parent().requestId, date, archive, editing?.id)),
          catchError((error: { message?: string }) => {
            this.previewLoading.set(false);
            this.previewError.set(error.message || 'تعذّر توليد كود المشروع.');
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ projectCode }) => {
      this.projectCode.set(projectCode);
      this.previewLoading.set(false);
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || (!this.assignment() && !this.projectCode())) return;
    const v = this.form.getRawValue();
    const a = this.assignment();
    const body: StudyAssignmentInput = {
      requestId: this.parent().requestId, followingDepartmentId: v.followingDepartmentId, assignmentDate: v.assignmentDate,
      ...(this.needsArchiveNumber() ? { adminArchiveNumber: v.adminArchiveNumber.trim() } : {}),
      allocatedBudget: v.allocatedBudget, scopeSummary: v.scopeSummary.trim(),
      needsTechnicalEvaluation: v.needsTechnicalEvaluation, needsResourceEstimate: v.needsResourceEstimate,
      needsPreliminaryBudget: v.needsPreliminaryBudget, needsFinalRecommendation: v.needsFinalRecommendation,
      referralDate: v.referralDate, responseDeadline: v.responseDeadline, priority: v.priority,
      rowVersion: a?.rowVersion ?? null
    };
    const call = a ? this.service.update('assignments', a.id, body) : this.service.create('assignments', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
