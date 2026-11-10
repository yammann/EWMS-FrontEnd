import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { map } from 'rxjs';
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
import { optional } from '../utils/form-rows';

/** الطلب الذي يُصدر له التكليف (من صفحة الطلب، أو من التكليف نفسه عند التعديل) */
export interface AssignmentParent { requestId: number; requestNumber: string; mainBeneficiary: string; branchId: number; }

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
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  templateUrl: './assignment-form-dialog.html'
})
export class StudyAssignmentFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private lookups = inject(LookupsService);

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

  form = inject(FormBuilder).nonNullable.group({
    followingDepartmentId: [0, Validators.min(1)],
    assignmentDate: [localDateInput(), Validators.required],
    projectCode: ['', Validators.maxLength(50)],
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
      this.form.reset({
        followingDepartmentId: a.followingDepartmentId, assignmentDate: dateOnly(a.assignmentDate),
        projectCode: a.projectCode ?? '', allocatedBudget: a.allocatedBudget, scopeSummary: a.scopeSummary,
        needsTechnicalEvaluation: a.needsTechnicalEvaluation, needsResourceEstimate: a.needsResourceEstimate,
        needsPreliminaryBudget: a.needsPreliminaryBudget, needsFinalRecommendation: a.needsFinalRecommendation,
        referralDate: dateOnly(a.referralDate), responseDeadline: dateOnly(a.responseDeadline), priority: a.priority
      });
    }
    // القسم المتابع من أقسام فرع الطلب (يرفض الخادم غيرها)
    const branchId = this.parent().branchId;
    this.lookups.departments().pipe(
      map(list => list.filter(d => d.branchId === branchId)),
      orEmpty(() => this.missing.set('تعذّر تحميل الأقسام — تحتاج صلاحية «عرض الأقسام».'))
    ).subscribe(list => this.departments.set(list));
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const a = this.assignment();
    const body: StudyAssignmentInput = {
      requestId: this.parent().requestId, followingDepartmentId: v.followingDepartmentId, assignmentDate: v.assignmentDate,
      projectCode: optional(v.projectCode), allocatedBudget: v.allocatedBudget, scopeSummary: v.scopeSummary.trim(),
      needsTechnicalEvaluation: v.needsTechnicalEvaluation, needsResourceEstimate: v.needsResourceEstimate,
      needsPreliminaryBudget: v.needsPreliminaryBudget, needsFinalRecommendation: v.needsFinalRecommendation,
      referralDate: v.referralDate, responseDeadline: v.responseDeadline, priority: v.priority,
      rowVersion: a?.rowVersion ?? null
    };
    const call = a ? this.service.update('assignments', a.id, body) : this.service.create('assignments', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
