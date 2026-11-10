import { StudyApproval, StudyChain, StudyDecision, StudyDocumentKind, StudyPerson } from '../data-access/studies.models';

export type RouteTone = 'info' | 'wait' | 'done';

/** أين وصل المستند وإلى أين يتجه: عنوان، شرح، ورابط إلى المستند التالي إن صدر */
export interface RouteNote { tone: RouteTone; title: string; text: string; link?: string; linkLabel?: string; }

export interface RouteDoc {
  status: number; approvals: StudyApproval[]; chain: StudyChain | null; followingDepartmentName?: string; recommendation?: number;
  nextSigners?: StudyPerson[] | null; nextSignersTotal?: number; nextIssuers?: StudyPerson[] | null; nextIssuersTotal?: number;
}

/** «فلان (القسم)، فلانة (القسم) و3 آخرين» */
export function peopleText(people: readonly StudyPerson[], total = people.length): string {
  const names = people.map(p => p.fullName + (p.departmentName ? ' (' + p.departmentName + ')' : ''));
  const more = total - people.length;
  return names.join('، ') + (more > 0 ? ` و${more} آخرين` : '');
}

/** من يوقّع كل مستند بالترتيب (يطابق StudyRules.RequiredSigners في الخادم) */
const SIGNERS: Partial<Record<StudyDocumentKind, string>> = {
  assignments: 'رئيس الفرع',
  responses: 'القسم المتابع ثم التخطيط وإدارة المشاريع',
  startOrders: 'رئيس القسم المختص ثم رئيس الفرع'
};

/** المرحلة التالية بعد كل مستند وصلاحية من يصدرها (الخادم لا يرسل إشعاراً لهم، فتُذكر هنا) */
const NEXT: Record<StudyDocumentKind, { name: string; who: (d: RouteDoc) => string }> = {
  requests: { name: 'التكليف الداخلي', who: () => 'يُصدره من يملك صلاحية «إصدار تكليف داخلي» في الفرع' },
  assignments: { name: 'إشعار الرد', who: d => `يكتبه القسم المتابع${d.followingDepartmentName ? ' (' + d.followingDepartmentName + ')' : ''}` },
  responses: { name: 'أمر البدء', who: () => 'يُصدره من يملك صلاحية «إصدار أمر البدء» في الفرع' },
  startOrders: { name: 'مشروع الدراسة', who: () => 'يُنشئه من يملك صلاحية «إنشاء مشروع» (إدارة المشاريع)' }
};

/** المستند التالي إن صدر: رقمه أو اسمه ورابطه */
function nextIssued(kind: StudyDocumentKind, c: StudyChain | null): { label: string; link: string } | null {
  if (!c) return null;
  switch (kind) {
    case 'requests': return c.assignmentId ? { label: c.assignmentNumber ?? 'التكليف الداخلي', link: `/studies/assignments/${c.assignmentId}` } : null;
    case 'assignments': return c.responseId ? { label: 'إشعار الرد', link: `/studies/responses/${c.responseId}` } : null;
    case 'responses': return c.startOrderId ? { label: c.startOrderNumber ?? 'أمر البدء', link: `/studies/start-orders/${c.startOrderId}` } : null;
    case 'startOrders': return c.projectId ? { label: c.projectCode ?? 'المشروع', link: `/studies/projects/${c.projectId}` } : null;
  }
}

/**
 * مسار المستند للقارئ، من حالته وتواقيعه وسلسلته: مسودة ← بانتظار توقيع فلان ← معتمد وانتقل إلى كذا.
 * الرفض والإلغاء لهما تنبيههما الخاص في الصفحة (يرجع null).
 */
export function routeNote(kind: StudyDocumentKind, d: RouteDoc): RouteNote | null {
  const next = NEXT[kind];
  switch (d.status) {
    case 1:
      return kind === 'requests'
        ? { tone: 'info', title: 'مسودة لم تُسجَّل بعد', text: `عند التسجيل النهائي يُعتمد الطلب فوراً بلا توقيعات، ثم تنتقل الدراسة إلى مرحلة «${next.name}».` }
        : { tone: 'info', title: 'مسودة لم تُرسل بعد', text: `بعد الإرسال يوقّعه بالترتيب: ${SIGNERS[kind]}. وباعتماده تنتقل الدراسة إلى «${next.name}».` };
    case 2: {
      const rows = [...d.approvals].sort((a, b) => a.sortOrder - b.sortOrder);
      const waiting = rows.find(r => r.decision === StudyDecision.Pending);
      const done = rows.filter(r => r.decision !== StudyDecision.Pending).length;
      const progress = `اكتمل ${done} من ${rows.length} تواقيع، وباكتمالها يُعتمد المستند وتنتقل الدراسة إلى «${next.name}».`;
      const who = d.nextSigners == null ? '' : d.nextSigners.length
        ? ` يوقّعه: ${peopleText(d.nextSigners, d.nextSignersTotal)}.`
        : ` لا موظف يملك صلاحية «توقيع بصفة ${waiting?.signerRoleName ?? ''}» في الحد المطلوب — راجع مدير النظام.`;
      return { tone: 'wait', title: waiting ? `بانتظار توقيع «${waiting.signerRoleName}»` : 'بانتظار الاعتماد', text: progress + who };
    }
    case 3: {
      if (kind === 'responses' && d.recommendation === 3)
        return { tone: 'done', title: 'اعتُمد الرد بتوصية «غير متاح»', text: 'تنتهي الدراسة عند هذا الرد ولا يصدر أمر بدء.' };
      const issued = nextIssued(kind, d.chain);
      return issued
        ? { tone: 'done', title: kind === 'requests' ? `سُجّل الطلب وانتقل إلى «${next.name}»` : `اعتُمد وانتقل إلى «${next.name}»`, text: 'المستند التالي:', link: issued.link, linkLabel: issued.label }
        : { tone: 'wait', title: kind === 'requests' ? `سُجّل الطلب، والخطوة التالية: «${next.name}»` : `اعتُمد، والخطوة التالية: «${next.name}»`, text: issuersText(next.name, next.who(d), d) };
    }
    default:
      return null;
  }
}

/** من يصدر المستند التالي: أسماؤهم من الخادم، أو تنبيه إن لم يملك الصلاحية أحد، أو الوصف العام للخوادم التي لا ترسل الأسماء */
function issuersText(nextName: string, generic: string, d: RouteDoc): string {
  if (d.nextIssuers == null) return `لم يصدر بعد — ${generic}.`;
  return d.nextIssuers.length
    ? `لم يصدر بعد — يُصدره: ${peopleText(d.nextIssuers, d.nextIssuersTotal)}.`
    : `لم يصدر بعد، ولا موظف في الفرع يملك صلاحية إصدار «${nextName}» — راجع مدير النظام.`;
}
