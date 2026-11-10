import { Department, Office } from '@core/models/ewms.models';
import { buildUserFormData, hasAssignmentConflict, placementForRole } from './user-form';

const dept = (id: number, branchId: number) => ({ id, branchId } as Department);
const office = (id: number, departmentId: number) => ({ id, departmentId } as Office);
const entries = (f: FormData) => Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));

describe('placementForRole', () => {
  it('shows the placement fields for every role except SuperAdmin, whatever its letter case', () => {
    expect(placementForRole('رئيس قسم')).toEqual({ needsBranch: true, needsDepartment: true, needsOffice: true });
    expect(placementForRole('SuperAdmin')).toEqual({ needsBranch: false, needsDepartment: false, needsOffice: false });
    expect(placementForRole('superadmin').needsBranch).toBe(false);
    expect(placementForRole(undefined).needsBranch).toBe(true);
  });
});

describe('hasAssignmentConflict', () => {
  const departments = [dept(1, 10), dept(2, 20)];
  const offices = [office(5, 1), office(6, 2)];

  it('allows empty values and consistent choices', () => {
    expect(hasAssignmentConflict({}, departments, offices)).toBe(false);
    expect(hasAssignmentConflict({ branchId: '10', departmentId: '1', officeId: '5' }, departments, offices)).toBe(false);
    expect(hasAssignmentConflict({ departmentId: '1' }, departments, offices)).toBe(false);
  });
  it('rejects a department outside the chosen branch or an office outside the chosen department', () => {
    expect(hasAssignmentConflict({ branchId: '10', departmentId: '2' }, departments, offices)).toBe(true);
    expect(hasAssignmentConflict({ departmentId: '1', officeId: '6' }, departments, offices)).toBe(true);
  });
});

describe('buildUserFormData', () => {
  const value = { fullName: 'مستخدم', email: 'u@example.test', personalIdNumber: '  ab-12 ', phoneNumber: '0933 123 456', password: 'Passw0rd1', roleId: '3', branchId: '1', departmentId: '2', officeId: '' };
  const shown = placementForRole('دور');

  it('always sends the password when creating, cleans the personal id and the phone, and skips empty placement', () => {
    const body = entries(buildUserFormData(value, shown, { editing: false }));
    expect(body).toMatchObject({ FullName: 'مستخدم', Email: 'u@example.test', PersonalIdNumber: 'AB-12', RoleId: '3', Password: 'Passw0rd1', BranchId: '1', DepartmentId: '2' });
    expect(body['PhoneNumber']).toBe('0933123456');
    expect(body).not.toHaveProperty('OfficeId');
    expect(body).not.toHaveProperty('IsActive');
  });

  it('sends the password on edit only when it is changed, and always sends IsActive', () => {
    const same = entries(buildUserFormData({ ...value, password: '' }, shown, { editing: true, isActive: false }));
    expect(same).not.toHaveProperty('Password');
    expect(same['IsActive']).toBe('false');
    expect(entries(buildUserFormData(value, shown, { editing: true }))['Password']).toBe('Passw0rd1');
    expect(entries(buildUserFormData(value, shown, { editing: true }))['IsActive']).toBe('true');
  });

  it('sends no placement for a role that has none', () => {
    const body = entries(buildUserFormData(value, placementForRole('SuperAdmin'), { editing: false }));
    expect(body).not.toHaveProperty('BranchId');
    expect(body).not.toHaveProperty('DepartmentId');
  });
});
