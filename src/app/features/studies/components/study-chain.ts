import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/ui/icon';
import { DOCUMENT_STATUSES, StudyChain, StudyDocumentKind } from '../data-access/studies.models';

interface ChainStep {
  key: StudyDocumentKind | 'project';
  label: string;
  number: string | null;
  status: number | null;
  statusName: string;
  link: string | null;
}

type StepTone = 'done' | 'wait' | 'bad' | 'off' | 'missing';

const PROJECT_STATUS_NAMES: Record<number, string> = { 1: 'جارٍ', 2: 'معلّق', 3: 'مكتمل', 4: 'ملغى' };
/** حالة المشروع بألوان حالات المستند: جارٍ/معلّق = بانتظار، مكتمل = معتمد، ملغى = ملغى */
const PROJECT_TONE: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 5 };
const docStatusName = (s: number | null) => DOCUMENT_STATUSES.find(x => x.value === s)?.label ?? '';

/**
 * سلسلة الدراسة من الطلب إلى المشروع كمخطط خطوات: دائرة لكل خطوة على خط متصل،
 * المنجزة ممتلئة بعلامة ✓، والجارية أو المعلّقة بإطار وساعة، والمرفوضة بـ ✕، والملغاة بقفل، والتي لم تصدر متقطعة.
 * المستند الحالي بهالة واسمه أغمق؛ أرقام الخطوات الأخرى روابط. الخطوة التي لم تصدر لا تُنشأ من هنا
 * (زر «إنشاء التالي» في صفحة المستند السابق). في الشاشة الضيقة تصير قائمة عمودية بخط جانبي.
 */
@Component({
  selector: 'app-study-chain',
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    <ol class="chain" aria-label="سلسلة الدراسة">
      @for (step of steps(); track step.key; let i = $index) {
        <li [class]="'step ' + tone(step)" [class.current]="step.key === current()" [class.linked]="linked(i)" [class.filled]="filled(i)"
            [attr.aria-current]="step.key === current() ? 'step' : null">
          <span class="dot" aria-hidden="true">
            @switch (tone(step)) {
              @case ('done') { <app-icon name="checkmark" [size]="16" [weight]="2.4" /> }
              @case ('wait') { <app-icon name="clock" [size]="16" /> }
              @case ('bad') { <app-icon name="xmark" [size]="16" [weight]="2.4" /> }
              @case ('off') { <app-icon name="lock" [size]="15" /> }
            }
          </span>
          <span class="body">
            <span class="label">{{ step.label }}</span>
            @if (step.number) {
              @if (step.link && step.key !== current()) { <a class="number mono" [routerLink]="step.link">{{ step.number }}</a> }
              @else { <span class="number mono">{{ step.number }}</span> }
              @if (step.statusName) { <small class="state">{{ step.statusName }}</small> }
            } @else {
              <small class="state">لم يصدر بعد</small>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: [`
    .chain { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .step { position: relative; display: grid; justify-items: center; align-content: start; gap: 8px; text-align: center; min-width: 0; padding: 0 4px; }
    .dot { position: relative; z-index: 1; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%;
           background: var(--surface, #fff); color: var(--ink-500); box-shadow: inset 0 0 0 2px var(--ink-300); }
    /* الخط من مركز هذه الدائرة إلى مركز التالية */
    .step::after { content: ''; position: absolute; top: 15px; inset-inline-start: 50%; width: 100%; height: 2px; background: var(--ink-300); }
    .step:last-child::after { display: none; }
    .step.filled::after { background: var(--brand-600); }
    .step:not(.linked):not(:last-child)::after { background: none; border-top: 2px dashed var(--ink-300); height: 0; }
    .done .dot { background: var(--brand-600); color: var(--on-brand); box-shadow: none; }
    .wait .dot { color: var(--brand-700); box-shadow: inset 0 0 0 2px var(--brand-600); }
    .bad .dot { background: var(--danger-500); color: var(--on-danger); box-shadow: none; }
    .off .dot { color: var(--ink-500); }
    .missing .dot { box-shadow: none; border: 2px dashed var(--ink-300); background: transparent; }
    .current .dot { outline: 4px solid var(--brand-200); }
    .body { display: grid; gap: 2px; min-width: 0; justify-items: center; max-width: 100%; }
    .label { font-size: 12px; color: var(--ink-500); }
    .current .label { color: var(--ink-900); font-weight: 700; }
    .number { font-weight: 700; color: var(--ink-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    a.number { color: var(--brand-700); text-decoration: none; }
    a.number:hover { text-decoration: underline; }
    .state { font-size: 12px; color: var(--ink-500); }
    .done .state { color: var(--brand-700); }
    .wait .state { color: var(--warning-700); }
    .bad .state { color: var(--danger-700); }
    .missing { opacity: .65; }
    @media (max-width: 640px) {
      .chain { grid-template-columns: minmax(0, 1fr); gap: 14px; }
      .step { grid-template-columns: 32px minmax(0, 1fr); justify-items: start; text-align: start; gap: 12px; align-items: start; padding: 0; }
      .body { justify-items: start; }
      .step::after { top: 36px; inset-inline-start: 15px; width: 2px; height: calc(100% - 22px); }
      .step:not(.linked):not(:last-child)::after { border-top: 0; border-inline-start: 2px dashed var(--ink-300); width: 0; background: none; }
    }
  `]
})
export class StudyChainView {
  chain = input.required<StudyChain>();
  /** المستند المعروض في الصفحة */
  current = input<StudyDocumentKind | 'project' | null>(null);
  /** رقم الرد RSP (بيانات السلسلة من الخادم لا تحمله): تُمرّره الصفحة بعد جلبه، وإلا يظهر اسم الخطوة */
  responseNumber = input<string | null>(null);

  /** حالة الخطوة لشكلها: done منجزة، wait جارية أو بانتظار، bad مرفوضة، off ملغاة، missing لم تصدر */
  tone(step: ChainStep): StepTone {
    if (!step.number) return 'missing';
    switch (step.status) { case 3: return 'done'; case 4: return 'bad'; case 5: return 'off'; default: return 'wait'; }
  }
  /** الخط بعد الخطوة i صلب إن وُجدت التالية */
  linked(i: number) { return !!this.steps()[i + 1]?.number; }
  /** وممتلئ بلون العلامة إن اكتملت الخطوة i */
  filled(i: number) { return this.linked(i) && this.tone(this.steps()[i]) === 'done'; }

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
