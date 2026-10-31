import type {
  DeliverableTypeResponseDto, StudyDeliverableDto, StudyDetailDto, StudyListItemDto, StudySubmissionDto,
  DeliverableTypeRequestDto, StudyDeliverableRequestDto, StudyOrderRequestDto
} from '@core/api/api-types';
import { Conforms, conforms } from '@core/api/contract-check';
import type { DeliverableInput, DeliverableType, DeliverableTypeInput, Study, StudyDeliverable, StudyInput, StudyItem, StudySubmission } from './studies.models';

describe('studies models conform to the backend contract', () => {
  it('match the DTOs the server sends and accepts', () => {
    conforms<Conforms<DeliverableType, DeliverableTypeResponseDto>>();
    conforms<Conforms<StudyItem, StudyListItemDto>>();
    conforms<Conforms<StudyDeliverable, StudyDeliverableDto>>();
    conforms<Conforms<StudySubmission, StudySubmissionDto>>();
    conforms<Conforms<Study, StudyDetailDto>>();
    conforms<Conforms<DeliverableTypeInput, DeliverableTypeRequestDto>>();
    conforms<Conforms<DeliverableInput, StudyDeliverableRequestDto>>();
    conforms<Conforms<StudyInput, StudyOrderRequestDto>>();
    expect(true).toBe(true);
  });
});
