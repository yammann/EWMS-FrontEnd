import type {
  AgreementLineRequestDto, PricingAgreementDetailDto, PricingAgreementListItemDto, PricingAgreementRequestDto, PricingAssigneeDto, PricingComparisonRowDto,
  CorrectReferencePriceRequestDto, ReconciliationCandidateDto, ReconciliationDetailDto, ReconciliationLineDto, ReconciliationListItemDto, ReconciliationRequestDto, PricingDetailDto, PricingItemDto, PricingItemRequestDto, PricingLineRequestDto, PricingListItemDto, PricingOfferDto, PricingOfferRequestDto,
  PricingRequestRequestDto, PricingTotalDto, ReferencePriceDetailDto, ReferencePriceImportReportDto, ReferencePriceImportRowDto, ReferencePriceListItemDto, ReferencePriceRequestDto
} from '@core/api/api-types';

// نماذج الواجهة هي أنواع العقد نفسها المولَّدة من الباكاند: الأعلام (can…) وصفوف المقارنة يحسبها الخادم بقواعده

export type PricingListItem = PricingListItemDto;
export type PricingRequest = PricingDetailDto;
export type PricingItem = PricingItemDto;
export type ComparisonRow = PricingComparisonRowDto;
export type PricingOffer = PricingOfferDto;
export type PricingTotal = PricingTotalDto;
export type PricingAssignee = PricingAssigneeDto;
export type PricingRequestInput = PricingRequestRequestDto;
export type PricingItemInput = PricingItemRequestDto;
export type PricingOfferInput = PricingOfferRequestDto;
export type PricingLineInput = PricingLineRequestDto;

export type AgreementListItem = PricingAgreementListItemDto;
export type Agreement = PricingAgreementDetailDto;
export type AgreementInput = PricingAgreementRequestDto;
export type AgreementLineInput = AgreementLineRequestDto;

export type ReferencePriceItem = ReferencePriceListItemDto;
export type ReferencePrice = ReferencePriceDetailDto;
export type ReferencePriceInput = ReferencePriceRequestDto;
export type ReferencePriceCorrection = CorrectReferencePriceRequestDto;
export type Reconciliation = ReconciliationDetailDto;
export type ReconciliationItem = ReconciliationListItemDto;
export type ReconciliationLine = ReconciliationLineDto;
export type ReconciliationCandidate = ReconciliationCandidateDto;
export type ReconciliationInput = ReconciliationRequestDto;

/** حالة المطابقة (ReconciliationStatus): الثماني المعتمدة + مسودة وملغى */
export const RECONCILIATION_STATUS = { draft: 1, match: 2, partial: 3, priceDiff: 4, quantityDiff: 5, incomplete: 6, needsReview: 7, approved: 8, returned: 9, cancelled: 10 } as const;
export const RECONCILIATION_STATUSES = [
  { value: 1, label: 'مسودة' }, { value: 2, label: 'مطابق' }, { value: 3, label: 'مطابق جزئياً' }, { value: 4, label: 'يوجد فرق في السعر' }, { value: 5, label: 'يوجد فرق في الكمية' },
  { value: 6, label: 'بيانات غير مكتملة' }, { value: 7, label: 'يحتاج إلى مراجعة' }, { value: 8, label: 'معتمد بعد التدقيق' }, { value: 9, label: 'معاد للتصحيح' }, { value: 10, label: 'ملغى' }
] as const;
/** النتائج التي يسجّلها المدقق (الست الأولى) */
export const AUDIT_RESULTS = RECONCILIATION_STATUSES.filter(s => s.value >= 2 && s.value <= 7);
export const DOCUMENT_KINDS = [{ value: 1, label: 'فاتورة' }, { value: 2, label: 'كشف' }] as const;
export const REFERENCE_KIND = { none: 1, offerLine: 2, referencePrice: 3 } as const;

export interface ReconciliationFilter { branchId: number | null; status: number | null; supplierId: number | null; projectId: number | null; search: string; page: number; pageSize: number; }

export type ReferencePriceImportReport = ReferencePriceImportReportDto;
export type ReferencePriceImportRow = ReferencePriceImportRowDto;

/** حالة السعر المرجعي (ReferencePriceStatus): تاريخي، معتمد للاستخدام الحالي، مُستبدَل بتصحيح */
export const REFERENCE_STATUS = { historical: 1, approved: 2, superseded: 3 } as const;
export const REFERENCE_STATUSES = [{ value: 1, label: 'تاريخي' }, { value: 2, label: 'معتمد للاستخدام الحالي' }, { value: 3, label: 'مُستبدَل بتصحيح' }] as const;
/** مصدر السعر عند الإضافة: يدوي أو عرض مورد/مستند (الاستيراد من Excel يأتي لاحقاً) */
export const REFERENCE_SOURCES = [{ value: 1, label: 'إدخال يدوي' }, { value: 2, label: 'عرض مورد أو مستند' }] as const;

export interface ReferencePriceFilter {
  branchId: number | null; search: string; supplierId: number | null; projectId: number | null; status: number | null; includeSuperseded: boolean;
  from: string; to: string; page: number; pageSize: number;
}

/** حالة طلب التسعير (PricingRequestStatus) */
export const PRICING_STATUS = { registered: 1, collecting: 2, recommended: 3, approved: 4, rejected: 5, resultSent: 6, cancelled: 7 } as const;
export const PRICING_STATUSES = [
  { value: 1, label: 'مسجَّل' }, { value: 2, label: 'قيد جمع العروض' }, { value: 3, label: 'بانتظار الاعتماد' }, { value: 4, label: 'معتمد' },
  { value: 5, label: 'مرفوض' }, { value: 6, label: 'أُرسلت النتيجة' }, { value: 7, label: 'ملغى' }
] as const;
/** المطابقة الفنية للبند (ConformityResult): لا يُختار سطر لم تتحقق مطابقته ولو كان الأرخص */
export const CONFORMITY = { notEvaluated: 1, conforming: 2, nonConforming: 3 } as const;
export const CONFORMITIES = [{ value: 1, label: 'لم تُقيَّم' }, { value: 2, label: 'مطابق' }, { value: 3, label: 'غير مطابق' }] as const;
/** قرار الاعتماد (Decision) */
export const PRICING_DECISION = { approve: 1, reject: 2, return: 3 } as const;
/** حالة محضر الاتفاق (AgreementStatus) */
export const AGREEMENT_STATUS = { draft: 1, submitted: 2, approved: 3, returned: 4, cancelled: 5 } as const;
export const AGREEMENT_STATUSES = [
  { value: 1, label: 'مسوّدة' }, { value: 2, label: 'بانتظار الاعتماد' }, { value: 3, label: 'معتمد' }, { value: 4, label: 'أُعيد للتصحيح' }, { value: 5, label: 'ملغى' }
] as const;

export interface PricingFilter {
  branchId: number | null; projectId: number | null; status: number | null; search: string; overdueOnly: boolean; mine: boolean; page: number; pageSize: number;
}
export interface AgreementFilter { branchId: number | null; status: number | null; supplierId: number | null; search: string; page: number; pageSize: number; }

export interface PricingAccess {
  canView: boolean; canRegister: boolean; canAssign: boolean; canPrepareOffers: boolean; canApprove: boolean; canSendResult: boolean;
  canViewAgreements: boolean; canPrepareAgreement: boolean; canApproveAgreement: boolean;
  canViewReferencePrices: boolean; canAddReferencePrice: boolean; canApproveReferencePrice: boolean; canImportReferencePrices: boolean;
  canViewReconciliations: boolean; canPrepareReconciliation: boolean; canApproveReconciliation: boolean;
  /** يختار الفرع (نظرة المؤسسة) */
  canChooseBranch: boolean;
}

/** عملات شائعة تُقترح في نموذج العرض؛ النظام لا يحوّل بينها ولا يجمعها */
export const COMMON_CURRENCIES = ['SYP', 'USD', 'EUR'] as const;
