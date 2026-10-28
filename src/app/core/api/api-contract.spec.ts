import type { Branch, Department, Office, User } from '@core/models/ewms.models';
import type { BranchResponseDto, DepartmentResponseDto, OfficeResponseDto, UserResponseDto } from './api-types';
import { Conforms, conforms } from './contract-check';

describe('core UI models conform to the backend contract', () => {
  it('match the DTOs the server sends', () => {
    conforms<Conforms<Branch, BranchResponseDto>>();
    conforms<Conforms<Department, DepartmentResponseDto>>();
    conforms<Conforms<Office, OfficeResponseDto>>();
    conforms<Conforms<User, UserResponseDto>>();
    expect(true).toBe(true);
  });
});
