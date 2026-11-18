/** فرع الدراسات المركزية — القوائم (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyLinkedDocument } from './enums.models';

/** نوع مرفق أو اختصاص هندسي أو جهة مستفيدة */
export interface StudyLookup { id: number; name: string; isActive: boolean; code?: string | null; }
export interface StudyLookupInput { name: string; isActive: boolean; code?: string | null; }

export interface StudyStageType {
  id: number; name: string; defaultOrder: number; defaultWeight: number;
  linkedDocument: StudyLinkedDocument; linkedDocumentName: string; isActive: boolean;
}
export interface StudyStageTypeInput {
  name: string; defaultOrder: number; defaultWeight: number; linkedDocument: StudyLinkedDocument; isActive: boolean;
}
