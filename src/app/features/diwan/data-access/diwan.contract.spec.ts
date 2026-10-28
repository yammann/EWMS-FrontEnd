import type {
  CorrespondenceAttachmentDto, CorrespondenceHistoryDto, CorrespondenceListItemDto, CorrespondencePrintDto, CorrespondenceReferralDto,
  CorrespondenceResponseDto, CorrespondenceStatusResponseDto, CorrespondenceTypeResponseDto, ReferralDepartmentDto, ReferralOfficeDto, ReferralUserDto
} from '@core/api/api-types';
import { Conforms, conforms } from '@core/api/contract-check';
import type {
  Correspondence, CorrespondenceAttachment, CorrespondenceItem, CorrespondencePrint, CorrespondenceStatus, CorrespondenceType, HistoryEntry,
  Referral, ReferralDepartment, ReferralOffice, ReferralUser
} from './diwan.models';

describe('diwan models conform to the backend contract', () => {
  it('match the DTOs the server sends', () => {
    conforms<Conforms<CorrespondenceType, CorrespondenceTypeResponseDto>>();
    conforms<Conforms<CorrespondenceStatus, CorrespondenceStatusResponseDto>>();
    conforms<Conforms<CorrespondenceItem, CorrespondenceListItemDto>>();
    conforms<Conforms<Correspondence, CorrespondenceResponseDto>>();
    conforms<Conforms<Referral, CorrespondenceReferralDto>>();
    conforms<Conforms<CorrespondenceAttachment, CorrespondenceAttachmentDto>>();
    conforms<Conforms<HistoryEntry, CorrespondenceHistoryDto>>();
    conforms<Conforms<CorrespondencePrint, CorrespondencePrintDto>>();
    conforms<Conforms<ReferralDepartment, ReferralDepartmentDto>>();
    conforms<Conforms<ReferralOffice, ReferralOfficeDto>>();
    conforms<Conforms<ReferralUser, ReferralUserDto>>();
    expect(true).toBe(true);
  });
});
