import type {
  AgreementLineRequestDto, PricingAgreementDetailDto, PricingAgreementListItemDto, PricingAgreementRequestDto, PricingAssigneeDto, PricingComparisonRowDto,
  PricingDetailDto, PricingItemDto, PricingItemRequestDto, PricingLineRequestDto, PricingListItemDto, PricingOfferDto, PricingOfferRequestDto,
  PricingRequestRequestDto, PricingTotalDto
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
  /** يختار الفرع (نظرة المؤسسة) */
  canChooseBranch: boolean;
}

/** عملات شائعة تُقترح في نموذج العرض؛ النظام لا يحوّل بينها ولا يجمعها */
export const COMMON_CURRENCIES = ['SYP', 'USD', 'EUR'] as const;
