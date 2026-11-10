/** فرع الدراسات المركزية — المرفقات والسجل (من studies.models.ts؛ التعليق الشارح للنسخة هناك) */
import { StudyOwnerType } from './enums.models';

export interface StudyAttachment {
  id: number; ownerType: StudyOwnerType; ownerId: number; attachmentTypeId: number; attachmentTypeName: string;
  fileName: string; contentType: string;
  /** بالبايت */
  size: number;
  previewable: boolean; uploadedByName: string; uploadedAt: string; canDelete: boolean;
}

export interface StudyActivityLog {
  id: number; entityType: number; entityTypeName: string; entityId: number;
  action: number; actionName: string; title: string; details: string | null;
  userId: number; userName: string; createdAt: string;
}
