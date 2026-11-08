import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCUMENT_STATUSES, StudyChain, StudyDocumentKind } from '../data-access/studies.models';
import { StudyStatusChip } from './study-status-chip';

interface ChainStep {
  key: StudyDocumentKind | 'project';
  label: string;
  number: string | null;
  status: number | null;
  statusName: string;
  link: string | null;
}

const PROJECT_STATUS_NAMES: Record<number, string> = { 1: 'جارٍ', 2: 'معلّق', 3: 'مكتمل', 4: 'ملغى' };
/** حالة المشروع بألوان حالات المستند: جارٍ/معلّق = بانتظار، مكتمل = معتمد، ملغى = ملغى */
const PROJECT_TONE: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 5 };
const docStatusName = (s: number | null) => DOCUMENT_STATUSES.find(x => x.value === s)?.label ?? '';

/**
 * سلسلة الدراسة من الطلب إلى المشروع: كل خطوة برقمها وحالتها ورابطها، والمستند الحالي مميَّز.
 * الخطوة التي لم تصدر بعد تظهر باهتة — لا تُنشأ من هنا (زر «إنشاء التالي» في صفحة المستند السابق).
 */
@Component({
  selector: 'app-study-chain',
  standalone: true,
  imports: [RouterLink, StudyStatusChip],
  template: `
    <ol class="chain" aria-label="سلسلة الدراسة">
      @for (step of steps(); track step.key; let i = $index) {
        <li [class.current]="step.key === current()" [class.missing]="!step.number" [attr.aria-current]="step.key === current() ? 'step' : null">
          <span class="index" aria-hidden="true">{{ i + 1 }}</span>
          <span class="body">
            <span class="label">{{ step.label }}</span>
            @if (step.number) {
              @if (step.link && step.key !== current()) { <a class="number mono" [routerLink]="step.link">{{ step.number }}</a> }
              @else { <span class="number mono">{{ step.number }}</span> }
              @if (step.status) { <app-study-status-chip [status]="step.status" [name]="step.statusName" /> }
            } @else {
              <span class="pending">لم يصدر بعد</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: [`
    .chain { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    li { position: relative; display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--radius-md, 12px);
         background: var(--fill); min-width: 0; }
    li.current { background: var(--brand-50); box-shadow: inset 0 0 0 1.5px var(--brand-300); }
    li.missing { opacity: .6; }
    .index { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%;
             background: var(--surface, #fff); color: var(--ink-600); font-size: 13px; font-weight: 700; }
    li.current .index { background: var(--brand-600); color: var(--on-brand); }
    .body { display: grid; gap: 4px; min-width: 0; justify-items: start; }
    .label { font-size: 12px; color: var(--ink-500); }
    .number { font-weight: 700; color: var(--ink-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    a.number { color: var(--brand-700); text-decoration: none; }
    a.number:hover { text-decoration: underline; }
    .pending { font-size: 13px; color: var(--ink-400); }
    @media (max-width: 980px) { .chain { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .chain { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class StudyChainView {
  chain = input.required<StudyChain>();
  /** المستند المعروض في الصفحة */
  current = input<StudyDocumentKind | 'project' | null>(null);
  /** رقم الرد RSP (بيانات السلسلة من الخادم لا تحمله): تُمرّره الصفحة بعد جلبه، وإلا يظهر اسم الخطوة */
  responseNumber = input<string | null>(null);

  steps = computed<ChainStep[]>(() => {
    const c = this.chain();
    return [
      { key: 'requests', label: 'طلب تجهيز الدراسة', number: c.requestNumber, status: c.requestStatus, statusName: docStatusName(c.requestStatus), link: `/studies/requests/${c.requestId}` },
      { key: 'assignments', label: 'التكليف الداخلي', number: c.assignmentNumber, status: c.assignmentStatus, statusName: docStatusName(c.assignmentStatus), link: c.assignmentId ? `/studies/assignments/${c.assignmentId}` : null },
      { key: 'responses', label: 'إشعار الرد', number: c.responseId ? (this.responseNumber() ?? 'إشعار الرد') : null, status: c.responseStatus, statusName: docStatusName(c.responseStatus), link: c.responseId ? `/studies/responses/${c.responseId}` : null },
      { key: 'startOrders', label: 'أمر البدء', number: c.startOrderNumber, status: c.startOrderStatus, statusName: docStatusName(c.startOrderStatus), link: c.startOrderId ? `/studies/start-orders/${c.startOrderId}` : null },
      { key: 'project', label: 'المشروع', number: c.projectCode, status: c.projectStatus ? PROJECT_TONE[c.projectStatus] : null, statusName: c.projectStatus ? PROJECT_STATUS_NAMES[c.projectStatus] : '', link: c.projectId ? `/studies/projects/${c.projectId}` : null }
    ];
  });
}
