import type {
  AuditLogResponseDto, ProjectDocumentResponseDto, ProjectDocumentVersionResponseDto, ProjectMemberCandidateDto, ProjectMemberResponseDto,
  ProjectResponseDto, ProjectUploadResponseDto, ScheduleAffectedTaskDto, ScheduleConflictDto, ScheduleDelayResponseDto, ScheduleDependencyResponseDto,
  ScheduleDetailResponseDto, ScheduleExtensionItemResponseDto, ScheduleExtensionPreviewResponseDto, ScheduleExtensionResponseDto,
  ScheduleOverviewResponseDto, ScheduleProgressEntryResponseDto, ScheduleTaskResponseDto, ScheduleVersionResponseDto, StartOrderResponseDto
} from '@core/api/api-types';
import { Conforms, conforms } from '@core/api/contract-check';
import type {
  AuditEntry, DocumentVersion, MemberCandidate, Project, ProjectDocument, ProjectMember, UploadSession
} from './projects.models';
import type {
  AffectedTask, ExtensionItem, ExtensionPreview, ProgressEntry, ScheduleConflict, ScheduleDelay, ScheduleDependency, ScheduleDetail,
  ScheduleExtension, ScheduleOverview, ScheduleTask, ScheduleVersion, StartOrder
} from './schedule.models';

describe('projects and schedule models conform to the backend contract', () => {
  it('projects, documents and uploads', () => {
    conforms<Conforms<Project, ProjectResponseDto>>();
    conforms<Conforms<ProjectMember, ProjectMemberResponseDto>>();
    conforms<Conforms<MemberCandidate, ProjectMemberCandidateDto>>();
    conforms<Conforms<AuditEntry, AuditLogResponseDto>>();
    conforms<Conforms<ProjectDocument, ProjectDocumentResponseDto>>();
    conforms<Conforms<DocumentVersion, ProjectDocumentVersionResponseDto>>();
    conforms<Conforms<UploadSession, ProjectUploadResponseDto>>();
    expect(true).toBe(true);
  });

  it('schedules, delays and extensions', () => {
    conforms<Conforms<StartOrder, StartOrderResponseDto>>();
    conforms<Conforms<ScheduleVersion, ScheduleVersionResponseDto>>();
    conforms<Conforms<ScheduleOverview, ScheduleOverviewResponseDto>>();
    conforms<Conforms<ScheduleTask, ScheduleTaskResponseDto>>();
    conforms<Conforms<ScheduleDependency, ScheduleDependencyResponseDto>>();
    conforms<Conforms<ScheduleDetail, ScheduleDetailResponseDto>>();
    conforms<Conforms<ProgressEntry, ScheduleProgressEntryResponseDto>>();
    conforms<Conforms<AffectedTask, ScheduleAffectedTaskDto>>();
    conforms<Conforms<ScheduleDelay, ScheduleDelayResponseDto>>();
    conforms<Conforms<ExtensionItem, ScheduleExtensionItemResponseDto>>();
    conforms<Conforms<ScheduleConflict, ScheduleConflictDto>>();
    conforms<Conforms<ExtensionPreview, ScheduleExtensionPreviewResponseDto>>();
    conforms<Conforms<ScheduleExtension, ScheduleExtensionResponseDto>>();
    expect(true).toBe(true);
  });
});
