export const StudyDiwanStage = {
  AwaitingDispatch: 1, AwaitingReply: 2, AwaitingBranchHead: 3, CorrectionRequested: 4,
  Referred: 5, Rejected: 6, ClosedWithoutStart: 7
} as const;
export type StudyDiwanStage = typeof StudyDiwanStage[keyof typeof StudyDiwanStage];

export const DIWAN_STAGES: Record<StudyDiwanStage, string> = {
  1: 'بانتظار تسجيل الصادر',
  2: 'بانتظار الرد المركزي',
  3: 'بانتظار إجراء رئيس الفرع',
  4: 'أُعيدت إلى ديوان الدراسات للتصحيح',
  5: 'أُحيلت إلى إدارة المشاريع',
  6: 'أُغلقت بسبب الرفض المركزي',
  7: 'أُغلقت بتوصية فنية «غير متاح»'
};

export const StudyDiwanDecision = { Approved: 1, Rejected: 2 } as const;
export type StudyDiwanDecision = typeof StudyDiwanDecision[keyof typeof StudyDiwanDecision];
export const StudyDiwanReviewAction = { Confirm: 1, ReturnForCorrection: 2 } as const;
export type StudyDiwanReviewAction = typeof StudyDiwanReviewAction[keyof typeof StudyDiwanReviewAction];

export interface StudyDiwanReply {
  id: number;
  number: string;
  date: string;
  decision: StudyDiwanDecision;
  fileName: string;
  recordedAt: string;
}

export interface StudyDiwanCase {
  stage: StudyDiwanStage;
  stageName: string;
  dispatchNumber: string | null;
  dispatchDate: string | null;
  reviewNote: string | null;
  replies: StudyDiwanReply[];
  canRegisterDispatch: boolean;
  canRegisterReply: boolean;
  canReview: boolean;
}

export interface StudyDiwanReferenceInput { number: string; date: string; rowVersion: string; }
