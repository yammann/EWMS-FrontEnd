import type {
  CommitteeDto, ContractAmendmentDto, ContractDetailDto, ContractEvaluationDto, ContractListItemDto, ContractOfferDto, ContractorEvaluationHistoryDto,
  ContractorResponseDto, EvaluationCriterionResponseDto, RetentionEntryDto,
  ContractRequestDto, ContractorRequestDto, EvaluationCriterionRequestDto, CommitteeRequestDto, ContractAmendmentRequestDto, ContractOfferRequestDto,
  RetentionRequestDto, RetentionDecisionRequestDto, ContractEvaluationRequestDto
} from '@core/api/api-types';

// نماذج الواجهة هي أنواع العقد نفسها المولَّدة من الباكاند (لا انحراف بينهما): الأعلام (can…) يحسبها الخادم بقواعده

export type Contractor = ContractorResponseDto;
export type ContractorInput = ContractorRequestDto;
export type EvaluationCriterion = EvaluationCriterionResponseDto;
export type EvaluationCriterionInput = EvaluationCriterionRequestDto;
export type ContractItem = ContractListItemDto;
export type Contract = ContractDetailDto;
export type ContractInput = ContractRequestDto;
export type ContractOffer = ContractOfferDto;
export type OfferInput = ContractOfferRequestDto;
export type Amendment = ContractAmendmentDto;
export type AmendmentInput = ContractAmendmentRequestDto;
export type Committee = CommitteeDto;
export type CommitteeInput = CommitteeRequestDto;
export type RetentionEntry = RetentionEntryDto;
export type RetentionInput = RetentionRequestDto;
export type RetentionDecisionInput = RetentionDecisionRequestDto;
export type Evaluation = ContractEvaluationDto;
export type EvaluationInput = ContractEvaluationRequestDto;
export type EvaluationHistoryItem = ContractorEvaluationHistoryDto;

/** طبيعة التعاقد (ContractingMethod): تختلف الحقول المطلوبة بحسبها */
export const CONTRACT_METHODS = [
  { value: 1, label: 'تنفيذ مباشر', hint: 'يُدخَل المتعاقد معه مباشرة' },
  { value: 2, label: 'مناقصة', hint: 'عروض وإرساء بقرار رسمي يحدّد المتعاقد' },
  { value: 3, label: 'عروض أسعار', hint: 'عروض وإرساء بقرار يحدّد المتعاقد' }
] as const;

/** حالة العقد (ContractStatus): تنتقل بقرار يدوي لا بمرور الوقت */
export const CONTRACT_STATUS = { contracting: 1, active: 2, completed: 3, terminated: 4, cancelled: 5 } as const;
export const CONTRACT_STATUSES = [
  { value: 1, label: 'قيد التعاقد' }, { value: 2, label: 'ساري' }, { value: 3, label: 'منجز' }, { value: 4, label: 'مفسوخ' }, { value: 5, label: 'ملغى' }
] as const;

/** قرار المبلغ المحتجز (RetentionDecisionKind): الإفراج نهائي */
export const RETENTION_DECISION = { release: 1, continue: 2 } as const;
/** حالة المبلغ المحتجز: محتجز، استمر احتجازه، أُفرج عنه */
export const RETENTION_STATE = { withheld: 1, continued: 2, released: 3 } as const;

/** مسار التقييم (EvaluationStatus) */
export const EVALUATION_STATUS = { draft: 1, submitted: 2, reviewed: 3 } as const;

export const CURRENCIES = ['SYP', 'USD', 'EUR'] as const;

export interface ContractFilter {
  projectId: number | null; status: number | null; method: number | null; contractorId: number | null; search: string;
  warrantyEndingOnly: boolean; page: number; pageSize: number;
}

/** صلاحيات العقود للقراءة (الأعلام الدقيقة على كل عقد من الخادم) */
export interface ContractAccess {
  canView: boolean; canCreate: boolean; canEdit: boolean;
  canViewContractors: boolean; canManageContractors: boolean; canCreateContractor: boolean; canEditContractor: boolean; canDeleteContractor: boolean;
  canViewEvaluations: boolean;
  canViewCriteria: boolean; canManageCriteria: boolean; canCreateCriterion: boolean; canEditCriterion: boolean; canDeleteCriterion: boolean;
  /** يختار الفرع في إعدادات المقاولين والمعايير (نظرة المؤسسة) */
  canChooseBranch: boolean;
}
