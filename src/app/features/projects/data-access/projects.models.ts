/** مراحل المشروع (مطابقة لـ ProjectStage في الباكاند؛ القيم المخزّنة لا تُعاد استعمالها) */
export const PROJECT_STAGES = [
  { value: 1, label: 'دراسة' },
  { value: 2, label: 'تعاقد' },
  { value: 3, label: 'تنفيذ' },
  { value: 4, label: 'استلام' },
  { value: 5, label: 'ضمان' },
  { value: 6, label: 'مغلق' },
  { value: 7, label: 'ملغى' }
] as const;

/** مغلق أو ملغى: لا تعديل ولا مشاركين ولا وثائق جديدة حتى تُعاد فتحه بتغيير المرحلة */
export const isFinishedStage = (stage: number) => stage === 6 || stage === 7;

/** أنواع الوثائق (مطابقة لـ ProjectDocumentKind، وأسماؤها من ProjectRules.KindAr) */
export const DOCUMENT_KINDS = [
  { value: 1, label: 'أمر الدراسة' },
  { value: 2, label: 'مراسلة' },
  { value: 3, label: 'مساحة ونمذجة' },
  { value: 4, label: 'مخطط معماري' },
  { value: 5, label: 'مخطط إنشائي' },
  { value: 6, label: 'مخطط كهربائي' },
  { value: 7, label: 'مخطط ميكانيكي' },
  { value: 8, label: 'كميات وتدقيق' },
  { value: 9, label: 'تخطيط' },
  { value: 10, label: 'قرار اعتماد' },
  { value: 11, label: 'عقد أو ملحق' },
  { value: 12, label: 'أمر مباشرة' },
  { value: 13, label: 'جدول زمني' },
  { value: 14, label: 'تقرير يومي أو أسبوعي' },
  { value: 15, label: 'تقرير جودة' },
  { value: 16, label: 'تقييم مقاول' },
  { value: 17, label: 'تسعير وعروض أسعار' },
  { value: 18, label: 'فاتورة أو كشف' },
  { value: 19, label: 'محضر استلام أو تسليم' },
  { value: 20, label: 'وثيقة ضمان' },
  { value: 21, label: 'قرار إغلاق' },
  { value: 99, label: 'أخرى' }
] as const;

export interface ProjectMember {
  userId: number; fullName: string; departmentName: string | null; title: string; addedAt: string;
}

export interface Project {
  id: number; number: string; referenceNumber: string | null; name: string; beneficiary: string; description: string;
  branchId: number; branchName: string; departmentId: number | null; departmentName: string | null;
  siteId: number | null; siteName: string | null;
  stage: number; stageName: string; isFinished: boolean;
  createdByUserId: number; createdByName: string; createdAt: string; updatedAt: string;
  rowVersion: string; membersCount: number; canEdit: boolean;
  /** في تفاصيل المشروع فقط */
  members: ProjectMember[] | null;
}

export interface ProjectInput {
  name: string; referenceNumber: string | null; beneficiary: string; description: string;
  branchId: number | null; departmentId: number | null; siteId: number | null;
  /** عند التعديل فقط */
  stage?: number; rowVersion?: string;
}

export interface ProjectFilter {
  search: string; branchId: number | null; departmentId: number | null; siteId: number | null; stage: number | null;
  page: number; pageSize: number;
}

export interface MemberCandidate { id: number; fullName: string; departmentName: string | null; }

export interface AuditEntry {
  id: number; createdAt: string; userId: number; userName: string; action: string; entityType: string;
  entityId: number | null; projectId: number | null; title: string; details: string;
}

/** أسماء أفعال سجل التدقيق (مفاتيح AuditActions في الباكاند) */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  created: 'إنشاء', updated: 'تعديل', stage: 'تغيير مرحلة', 'member-added': 'إضافة مشارك', 'member-removed': 'إزالة مشارك',
  uploaded: 'رفع', approved: 'اعتماد', downloaded: 'فتح', deleted: 'حذف',
  progress: 'تحديث إنجاز', classified: 'تصنيف', reordered: 'إعادة ترتيب', justified: 'رفع تبرير', submitted: 'رفع للاعتماد', rejected: 'رفض'
};

export interface DocumentVersion {
  id: number; versionNumber: number; fileName: string; contentType: string; size: number; sha256: string;
  source: string; note: string; uploadedByUserId: number; uploadedByName: string; uploadedAt: string;
  isApproved: boolean; approvedByName: string | null; approvedAt: string | null;
  previewable: boolean; canApprove: boolean;
}

export interface ProjectDocument {
  id: number; projectId: number; projectNumber: string; projectName: string; title: string; kind: number; kindName: string;
  createdByName: string; createdAt: string; versionsCount: number;
  latest: DocumentVersion | null; approved: DocumentVersion | null;
  /** في تفاصيل الوثيقة فقط */
  versions: DocumentVersion[] | null;
  canDelete: boolean;
}

export interface DocumentFilter {
  projectId: number | null; kind: number | null; search: string; from: string; to: string; page: number; pageSize: number;
}

/** حالات جلسة الرفع في الخادم (ProjectUploadStatus) */
export const UPLOAD_RECEIVING = 1, UPLOAD_PROCESSING = 2, UPLOAD_DONE = 3, UPLOAD_FAILED = 4;

export interface UploadSession {
  id: string; projectId: number; documentId: number | null; title: string; kind: number; fileName: string;
  size: number; received: number; chunkSize: number; status: number; statusName: string; error: string;
  versionId: number | null; createdAt: string; updatedAt: string;
}

export interface StartUploadInput {
  projectId: number; documentId: number | null; title: string; kind: number | null;
  fileName: string; size: number; source: string; note: string;
}
