/** فرع الدراسات المركزية — القوائم (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyLinkedDocument } from './enums.models';

/** نوع مرفق أو اختصاص هندسي */
export interface StudyLookup { id: number; name: string; isActive: boolean; }
export interface StudyLookupInput { name: string; isActive: boolean; }

export interface StudyStageType {
  id: number; name: string; defaultOrder: number; defaultWeight: number;
  linkedDocument: StudyLinkedDocument; linkedDocumentName: string; isActive: boolean;
}
export interface StudyStageTypeInput {
  name: string; defaultOrder: number; defaultWeight: number; linkedDocument: StudyLinkedDocument; isActive: boolean;
}
