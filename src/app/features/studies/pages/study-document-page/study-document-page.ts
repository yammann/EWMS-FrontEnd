import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { formatPhone } from '@core/utils/phone';
import { money } from '@core/utils/format';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { AppPermission } from '@core/constants/access';
import { AuthService } from '@core/services/auth.service';
import { StudyActivity } from '../../components/study-activity';
import { StudyApprovalsPanel } from '../../components/approvals-panel';
import { AssignmentParent, StudyAssignmentFormDialog } from '../../components/assignment-form-dialog';
import { StudyAttachments } from '../../components/study-attachments';
import { StudyProjectFormDialog } from '../../components/project-form-dialog';
import { StudyReasonDialog } from '../../components/reason-dialog';
import { StudyRequestFormDialog } from '../../components/request-form-dialog';
import { ResponseParent, StudyResponseFormDialog } from '../../components/response-form-dialog';
import { StudyResponsePlanningDialog } from '../../components/response-planning-dialog';
import { StartOrderParent, StudyStartOrderFormDialog } from '../../components/start-order-form-dialog';
import { StudyChainView } from '../../components/study-chain';
import { StudyStatusChip } from '../../components/study-status-chip';
import { StudyAccess } from '../../data-access/study-access';
import { StudyDocumentsService } from '../../data-access/study-documents.service';
import {
  StudyAssignment, StudyDocumentKind, StudyRecommendation, StudyRequest, StudyResponse, StudyStartOrder
} from '../../data-access/studies.models';
import { AnyStudyDocument, DOCUMENT_META, documentNumber } from '../../utils/document-meta';
import { RouteDoc, routeNote } from '../../utils/route-note';

/** نافذة مفتوحة: تعديل المستند نفسه أو إصدار التالي في السلسلة */
type Dialog = 'edit' | 'planning' | 'next' | 'cancel' | 'project' | null;

/**
 * صفحة مستند دراسة (طلب، تكليف، رد، أمر بدء) — نوعه من بيانات المسار.
 * السلسلة في الأعلى، ثم البيانات بأقسام النموذج الورقي، ثم التواقيع بالترتيب.
 * الأزرار من أعلام الخادم (canEdit/canSubmit/canCancel/canDelete/canCreate…) — لا تُعاد حساب القواعد هنا.
 */
@Component({
  selector: 'app-study-document-page',
  standalone: true,
  imports: [
    DatePipe, UtcPipe, RouterLink, Alert, EmptyState, Icon, StudyChainView, StudyStatusChip, StudyApprovalsPanel, StudyReasonDialog,
    StudyRequestFormDialog, StudyAssignmentFormDialog, StudyResponseFormDialog, StudyStartOrderFormDialog,
    StudyAttachments, StudyActivity, StudyResponsePlanningDialog, StudyProjectFormDialog
  ],
  templateUrl: './study-document-page.html',
  styleUrls: ['../../../../shared/styles/page-base.scss', '../../../../shared/styles/list-tools.scss', './study-document-page.scss']
})
export class StudyDocumentPage {
  private service = inject(StudyDocumentsService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private latest = latestRequest();
  /** صلاحية عرض سجل الدراسة */
  access = inject(StudyAccess).can;

  kind = signal<StudyDocumentKind>(inject(ActivatedRoute).snapshot.data['kind'] as StudyDocumentKind);
  meta = computed(() => DOCUMENT_META[this.kind()]);
  id = signal(0);

  doc = signal<AnyStudyDocument | null>(null);
  loading = signal(false);
  error = signal('');
  busy = signal(false);
  actionError = signal('');
  dialog = signal<Dialog>(null);

  money = money;
  formatPhone = formatPhone;
  notAvailable = StudyRecommendation.NotAvailable;

  /** رقم الرد RSP لبطاقة «إشعار الرد» في السلسلة */
  responseNumber = signal<string | null>(null);
  number = computed(() => { const d = this.doc(); return d ? documentNumber(this.kind(), d) : ''; });
  request = computed(() => this.kind() === 'requests' ? this.doc() as StudyRequest | null : null);
  assignment = computed(() => this.kind() === 'assignments' ? this.doc() as StudyAssignment | null : null);
  response = computed(() => this.kind() === 'responses' ? this.doc() as StudyResponse | null : null);
  startOrder = computed(() => this.kind() === 'startOrders' ? this.doc() as StudyStartOrder | null : null);

  /** الطلب الجذر للدراسة: سجلها واحد لكل السلسلة */
  rootRequestId = computed(() => {
    const d = this.doc();
    if (!d) return 0;
    return this.kind() === 'requests' ? d.id : (d as StudyAssignment | StudyResponse | StudyStartOrder).requestId;
  });
  /** رفع مرفقات المستند وحذفها: صلاحية تعديله، وأن لا يكون ملغى (والخادم يتحقق مجدداً) */
  canAttach = computed(() => {
    const d = this.doc();
    return !!d && d.status !== 5 && this.auth.hasPermission(this.meta().edit);
  });
  /** طباعة النموذج الورقي: PrintStudyDocuments (والخادم يفحص عرض المستند وحدّ الفرع) */
  canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintStudyDocuments));
  /** يتغيّر بعد رفع مرفق أو حذفه فيُحدَّث سجل الدراسة */
  logVersion = signal(0);
  /** مفتاح إعادة تحميل السجل: كل تغيّر في المستند (توقيع، إرسال، إلغاء…) أو في مرفقاته */
  logKey = computed(() => [this.logVersion(), this.doc()]);

  /** زر الإرسال: الطلب بلا موقّعين فيُعتمد فوراً */
  submitLabel = computed(() => this.kind() === 'requests' ? 'تسجيل نهائي' : 'إرسال للاعتماد');

  /** أين وصل المستند وإلى أين يتجه (مسودة، بانتظار توقيع فلان، معتمد وانتقل إلى كذا) */
  route = computed(() => { const d = this.doc(); return d ? routeNote(this.kind(), d as RouteDoc) : null; });

  /** إصدار المستند التالي في السلسلة (من علم الخادم) */
  next = computed<{ label: string } | null>(() => {
    const r = this.request(), a = this.assignment(), s = this.response();
    if (r?.canCreateAssignment) return { label: 'إصدار تكليف داخلي' };
    if (a?.canCreateResponse) return { label: 'كتابة إشعار الرد' };
    if (s?.canCreateStartOrder) return { label: 'إصدار أمر البدء' };
    if (this.startOrder()?.canCreateProject && this.access().createProject) return { label: 'إنشاء مشروع' };
    return null;
  });

  /** مخرجات التكليف المطلوبة (المعلَّمة فقط) */
  outputs = computed(() => {
    const a = this.assignment();
    if (!a) return [];
    return [
      a.needsTechnicalEvaluation && 'التقييم الفني الأولي وقابلية التنفيذ',
      a.needsResourceEstimate && 'تقدير الموارد والكوادر الهندسية والمدة',
      a.needsPreliminaryBudget && 'الميزانية التقديرية المبدئية للمشروع',
      a.needsFinalRecommendation && 'التوصية الفنية النهائية للقسم'
    ].filter(Boolean) as string[];
  });

  // ─────────── آباء النماذج: من المستند الحالي (للتعديل) أو له (لإصدار التالي) ───────────
  assignmentParent = computed<AssignmentParent | null>(() => {
    const r = this.request(), a = this.assignment();
    if (r) return { requestId: r.id, requestNumber: r.requestNumber, mainBeneficiary: r.mainBeneficiary, branchId: r.branchId };
    if (a) return { requestId: a.requestId, requestNumber: a.requestNumber, mainBeneficiary: a.mainBeneficiary, branchId: a.branchId };
    return null;
  });
  responseParent = computed<ResponseParent | null>(() => {
    const a = this.assignment(), s = this.response();
    if (a) return { assignmentId: a.id, assignmentNumber: a.assignmentNumber, followingDepartmentName: a.followingDepartmentName, branchId: a.branchId };
    if (s) return { assignmentId: s.assignmentId, assignmentNumber: s.assignmentNumber, followingDepartmentName: s.followingDepartmentName, branchId: s.branchId };
    return null;
  });
  startOrderParent = computed<StartOrderParent | null>(() => {
    const s = this.response(), o = this.startOrder();
    if (s) return { responseId: s.id, assignmentNumber: s.assignmentNumber, branchId: s.branchId, proposedManagerUserId: s.proposedManagerUserId };
    if (o) return { responseId: o.responseId, assignmentNumber: o.assignmentNumber, branchId: o.branchId, proposedManagerUserId: null };
    return null;
  });

  constructor() {
    effect(() => {
      const d = this.doc();
      untracked(() => {
        if (this.kind() === 'responses') { this.responseNumber.set((d as StudyResponse | null)?.responseNumber ?? null); return; }
        this.service.responseNumberOf(d?.chain).subscribe(n => this.responseNumber.set(n));
      });
    });
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.id.set(Number(p.get('id')));
      this.doc.set(null);
      this.dialog.set(null);
      this.load();
    });
  }

  load() {
    this.latest(this.service.get(this.kind(), this.id()) as Observable<AnyStudyDocument>, this.loading, this.error, d => this.doc.set(d));
  }

  async submit() {
    const message = this.kind() === 'requests'
      ? 'تسجيل الطلب نهائياً؟ يصبح معتمداً ولا يُعدَّل بعدها، ويمكن إصدار التكليف له.'
      : 'إرسال المستند للاعتماد؟ لا يُعدَّل أثناء التوقيع، ويُعاد إليك إن رُفض.';
    if (!await this.confirm.ask(message, this.submitLabel())) return;
    this.run(this.service.submit(this.kind(), this.id()) as Observable<AnyStudyDocument>, d => {
      this.doc.set(d);
      this.toast.success(this.kind() === 'requests' ? 'سُجّل الطلب نهائياً — الخطوة التالية: إصدار التكليف الداخلي' : 'أُرسل المستند للاعتماد — انظر «أين وصل» أعلى الصفحة');
    });
  }

  cancelDocument(reason: string) {
    this.run(this.service.cancel(this.kind(), this.id(), reason) as Observable<AnyStudyDocument>, d => {
      this.doc.set(d); this.dialog.set(null); this.toast.success('أُلغي المستند — يبقى في الأرشيف');
    });
  }

  async remove() {
    if (!await this.confirm.ask(`حذف المسودة «${this.number()}»؟ لا يمكن التراجع.`, 'حذف')) return;
    this.run(this.service.remove(this.kind(), this.id()), () => {
      this.toast.success('حُذفت المسودة');
      this.router.navigate(['/studies/documents'], { queryParams: { type: this.kind() === 'requests' ? null : this.kind() } });
    });
  }

  /** حُفظ المستند نفسه بعد التعديل */
  edited(d: AnyStudyDocument) { this.dialog.set(null); this.doc.set(d); this.toast.success('تم الحفظ'); }

  /** أُنشئ المشروع من أمر البدء: إلى صفحته */
  projectCreated(id: number) {
    this.dialog.set(null);
    this.toast.success('أُنشئ المشروع بمراحله من أنواع المراحل الفعّالة');
    this.router.navigate(['/studies/projects', id]);
  }

  /** أُنشئ المستند التالي: إلى صفحته */
  created(segment: string, id: number) {
    this.dialog.set(null);
    this.toast.success('أُنشئ المستند مسودةً — راجعه ثم أرسله للاعتماد');
    this.router.navigate(['/studies', segment, id]);
  }

  /** تغيّر سطر توقيع: يُعاد تحميل المستند (قد تتغيّر حالته وأعلامه) */
  decided() { this.toast.success('حُفظ القرار'); this.load(); }

  private run<T>(call: Observable<T>, done: (value: T) => void) {
    trackRequest(call, this.busy, this.actionError, done);
  }
}
