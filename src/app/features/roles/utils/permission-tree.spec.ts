import { Permission, Role } from '@core/models/ewms.models';
import { PermissionSectionDef } from './permission-sections';
import { buildPermissionSections, matchRoles, roleStats, withSelection } from './permission-tree';

const perm = (id: number, name: string, description = ''): Permission => ({ id, name, description } as Permission);
const role = (id: number, name: string, permissions: Permission[] = []): Role => ({ id, name, permissions } as Role);

describe('buildPermissionSections', () => {
  const defs: PermissionSectionDef[] = [
    { key: 'a', title: 'أ', groups: [{ key: 'g1', title: 'مجموعة', names: ['ViewX', 'EditX', 'Missing'] }] },
    { key: 'b', title: 'ب', groups: [{ key: 'g2', title: 'فارغة', names: ['Nothing'] }] }
  ];

  it('keeps only existing permissions, drops empty groups and sections', () => {
    const tree = buildPermissionSections([perm(1, 'ViewX'), perm(2, 'EditX')], defs);
    expect(tree.map(s => s.key)).toEqual(['a']);
    expect(tree[0].groups[0].items.map(p => p.name)).toEqual(['ViewX', 'EditX']);
    expect(tree[0].items).toHaveLength(2);
  });

  it('puts permissions that belong to no group in «أخرى» so they never get lost', () => {
    const tree = buildPermissionSections([perm(1, 'ViewX'), perm(9, 'BrandNew')], defs);
    expect(tree.at(-1)).toMatchObject({ key: 'others', title: 'أخرى' });
    expect(tree.at(-1)!.items.map(p => p.name)).toEqual(['BrandNew']);
  });
});

describe('matchRoles', () => {
  const roles = [
    role(1, 'رئيس قسم الصيانة', [perm(1, 'ViewMaintenanceRequests', 'عرض طلبات الصيانة')]),
    role(2, 'موظف الديوان', [perm(2, 'ApproveVacationFinal', 'اعتماد نهائي للإجازات')]),
    role(3, 'مدير', [])
  ];

  it('returns nothing for an empty query', () => {
    expect(matchRoles(roles, '  ')).toEqual([]);
  });

  it('matches by role name first, ignoring hamza and ta marbuta', () => {
    const m = matchRoles(roles, 'ديوان');
    expect(m.map(x => x.role.id)).toEqual([2]);
    expect(m[0].byName).toBe(true);
    expect(matchRoles(roles, 'الصيانه').map(x => x.role.id)).toEqual([1]);
  });

  it('falls back to roles holding a matching permission (name or Arabic description) when no role name matches', () => {
    const m = matchRoles(roles, 'اعتماد');
    expect(m.map(x => x.role.id)).toEqual([2]);
    expect(m[0]).toMatchObject({ byName: false, via: 'ApproveVacationFinal' });
    expect(matchRoles(roles, 'ApproveVacationFinal').map(x => x.role.id)).toEqual([2]);
  });
});

describe('roleStats', () => {
  it('summarizes roles and counts roles holding every permission', () => {
    const all = [perm(1, 'A'), perm(2, 'B')];
    const stats = roleStats([role(1, 'كامل', all), role(2, 'نصف', [all[0]]), role(3, 'بلا')], all);
    expect(stats).toEqual({ totalRoles: 3, totalPermissions: 2, avgPermissions: 1, fullRoles: 1 });
    expect(roleStats([], [])).toMatchObject({ totalRoles: 0, avgPermissions: 0 });
  });
});

describe('withSelection', () => {
  it('adds a group without touching the rest or duplicating', () => {
    expect(withSelection([1, 2], [2, 3], true).sort()).toEqual([1, 2, 3]);
  });
  it('removes only the given ids', () => {
    expect(withSelection([1, 2, 3], [2, 3], false)).toEqual([1]);
  });
});
