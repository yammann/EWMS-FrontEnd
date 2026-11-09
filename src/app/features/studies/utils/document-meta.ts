import { AppPermission, AppPermissionName } from '@core/constants/access';
import {
  StudyAssignment, StudyDocumentKind, StudyDocumentKinds, StudyOwnerType, StudyRequest, StudyResponse, StudyStartOrder
} from '../data-access/studies.models';

/** ما تحتاجه الواجهة عن كل نوع من مستندات الدراسة الأربعة */
export interface DocumentMeta {
  kind: StudyDocumentKind;
  /** جزء الرابط: /studies/<segment>/:id */
  segment: string;
  single: string;
  plural: string;
  /** اختصار النموذج الورقي */
  code: string;
  view: AppPermissionName;
  /** تعديل المستند: يفتح رفع مرفقاته وحذفها */
  edit: AppPermissionName;
  ownerType: StudyOwnerType;
}

export const DOCUMENT_META: Record<StudyDocumentKind, DocumentMeta> = {
  requests: { kind: 'requests', segment: 'requests', single: 'طلب تجهيز دراسة', plural: 'الطلبات', code: 'REQ', view: AppPermission.ViewStudyRequests, edit: AppPermission.EditStudyRequest, ownerType: 1 },
  assignments: { kind: 'assignments', segment: 'assignments', single: 'تكليف داخلي', plural: 'التكليفات', code: 'IPA', view: AppPermission.ViewStudyAssignments, edit: AppPermission.EditStudyAssignment, ownerType: 2 },
  responses: { kind: 'responses', segment: 'responses', single: 'إشعار رد', plural: 'الردود', code: 'الرد', view: AppPermission.ViewStudyResponses, edit: AppPermission.EditStudyResponse, ownerType: 3 },
  startOrders: { kind: 'startOrders', segment: 'start-orders', single: 'أمر بدء دراسة', plural: 'أوامر البدء', code: 'PIO', view: AppPermission.ViewStudyStartOrders, edit: AppPermission.EditStudyStartOrder, ownerType: 4 }
};
export const DOCUMENT_KINDS = Object.keys(DOCUMENT_META) as StudyDocumentKind[];

/** رابط صفحة صاحب التوقيع: مستند (طلب/تكليف/رد/أمر بدء) أو مشروع أو اعتماد مخططات أولي (CDA) */
export function ownerLink(ownerType: StudyOwnerType, ownerId: number): string | null {
  if (ownerType === 5) return `/studies/projects/${ownerId}`;
  if (ownerType === 10) return `/studies/design-approvals/${ownerId}`;
  const kind = DOCUMENT_KINDS.find(k => DOCUMENT_META[k].ownerType === ownerType);
  return kind ? `/studies/${DOCUMENT_META[kind].segment}/${ownerId}` : null;
}

export type AnyStudyDocument = StudyDocumentKinds[StudyDocumentKind]['item'];

/** رقم المستند كما يُعرض: الرد بلا رقم بعد فيُعرَّف بتكليفه */
export function documentNumber(kind: StudyDocumentKind, doc: AnyStudyDocument): string {
  switch (kind) {
    case 'requests': return (doc as StudyRequest).requestNumber;
    case 'assignments': return (doc as StudyAssignment).assignmentNumber;
    case 'responses': return (doc as StudyResponse).responseNumber || 'رد على ' + (doc as StudyResponse).assignmentNumber;
    case 'startOrders': return (doc as StudyStartOrder).orderNumber;
  }
}

/** تاريخ المستند نفسه (لا تاريخ إدخاله) */
export function documentDate(kind: StudyDocumentKind, doc: AnyStudyDocument): string {
  switch (kind) {
    case 'requests': return (doc as StudyRequest).requestDate;
    case 'assignments': return (doc as StudyAssignment).assignmentDate;
    case 'responses': return (doc as StudyResponse).responseDate;
    case 'startOrders': return (doc as StudyStartOrder).orderDate;
  }
}

/** yyyy-MM-dd من تاريخ الخادم (تواريخ المستندات أيام بلا وقت) */
export function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}
