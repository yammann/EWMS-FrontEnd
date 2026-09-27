import { canRequestVacation, placementForRole } from './user-placement';

// يجب أن تطابق Application/Features/Users/UserPlacement.cs في الباكاند
describe('User placement by role', () => {
  it('SuperAdmin belongs to no branch, department or office', () => {
    expect(placementForRole('SuperAdmin')).toEqual({ needsBranch: false, needsDepartment: false, needsOffice: false });
  });
  it('BranchManager belongs to a branch only', () => {
    expect(placementForRole('BranchManager')).toEqual({ needsBranch: true, needsDepartment: false, needsOffice: false });
  });
  it('Manager belongs to a branch and a department, not an office', () => {
    expect(placementForRole('Manager')).toEqual({ needsBranch: true, needsDepartment: true, needsOffice: false });
  });
  it('employees and custom roles need all three', () => {
    expect(placementForRole('Emp')).toEqual({ needsBranch: true, needsDepartment: true, needsOffice: true });
    expect(placementForRole('Custom')).toEqual({ needsBranch: true, needsDepartment: true, needsOffice: true });
  });
  it('only roles with a department can request vacations', () => {
    expect(canRequestVacation('SuperAdmin')).toBe(false);
    expect(canRequestVacation('BranchManager')).toBe(false);
    expect(canRequestVacation('Manager')).toBe(true);
    expect(canRequestVacation('Emp')).toBe(true);
  });
});
