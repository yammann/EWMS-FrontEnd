import type {
  ClosureWarningsDto, HandoverDetailDto, HandoverListItemDto, HandoverNoteDto, HandoverRequestDto, ConcludeHandoverRequestDto, HandoverNoteRequestDto, CommitteeRequestDto
} from '@core/api/api-types';

// نماذج الواجهة هي أنواع العقد نفسها المولَّدة من الباكاند: الأعلام (can…) يحسبها الخادم بقواعده

export type HandoverItem = HandoverListItemDto;
export type Handover = HandoverDetailDto;
export type HandoverNote = HandoverNoteDto;
export type ClosureWarnings = ClosureWarningsDto;
export type HandoverInput = HandoverRequestDto;
export type ConcludeInput = ConcludeHandoverRequestDto;
export type NoteInput = HandoverNoteRequestDto;
export type HandoverCommitteeInput = CommitteeRequestDto;

/** نوع الاستلام (HandoverKind): أولي ونهائي سجلان منفصلان */
export const HANDOVER_KINDS = [{ value: 1, label: 'استلام أولي' }, { value: 2, label: 'استلام نهائي' }] as const;
/** حالة المحضر (HandoverStatus) */
export const HANDOVER_STATUS = { requested: 1, formed: 2, concluded: 3, cancelled: 4 } as const;
export const HANDOVER_STATUSES = [
  { value: 1, label: 'طلب بانتظار تشكيل اللجنة' }, { value: 2, label: 'لجنة مشكَّلة' }, { value: 3, label: 'منتهٍ' }, { value: 4, label: 'ملغى' }
] as const;
/** النتيجة (HandoverResult) */
export const HANDOVER_RESULT = { withoutNotes: 1, withNotes: 2 } as const;
/** حالة ملاحظة اللجنة (HandoverNoteStatus): مفتوحة ← عولجت ← مغلقة بالتحقق */
export const NOTE_STATUS = { open: 1, fixed: 2, verified: 3 } as const;

export interface HandoverFilter {
  projectId: number | null; kind: number | null; status: number | null; search: string; openNotesOnly: boolean; page: number; pageSize: number;
}

export interface HandoverAccess { canView: boolean; canRequest: boolean; canManage: boolean; canFollowNotes: boolean; }
