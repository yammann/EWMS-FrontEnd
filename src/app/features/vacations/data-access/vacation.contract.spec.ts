import type { VacationAttachmentDto, VacationDaysPreviewDto, VacationResponseDto, VacationSegmentDto, VacationTypeResponseDto } from '@core/api/api-types';
import { Conforms, conforms } from '@core/api/contract-check';
import type { Vacation, VacationAttachment, VacationDaysPreview, VacationSegment, VacationType } from './vacation.models';

describe('vacation models conform to the backend contract', () => {
  it('match the DTOs the server sends', () => {
    conforms<Conforms<Vacation, VacationResponseDto>>();
    conforms<Conforms<VacationType, VacationTypeResponseDto>>();
    conforms<Conforms<VacationSegment, VacationSegmentDto>>();
    conforms<Conforms<VacationAttachment, VacationAttachmentDto>>();
    conforms<Conforms<VacationDaysPreview, VacationDaysPreviewDto>>();
    expect(true).toBe(true);
  });
});
