import { AppPermission } from '@core/constants/access';
import { PERMISSION_SECTIONS } from './permission-sections';

/** عقد بين ثوابت الصلاحيات في الواجهة (نسخة AppPermissions في الباك) وأقسام صفحة الأدوار: لا صلاحية تضيع في «أخرى» ولا اسم يخطئ */
describe('permission sections contract', () => {
  const placed = PERMISSION_SECTIONS.flatMap(s => s.groups.flatMap(g => g.names));
  const known = new Set<string>(Object.values(AppPermission));

  it('only names real permissions', () => {
    expect(placed.filter(n => !known.has(n))).toEqual([]);
  });

  it('places every permission in exactly one group (nothing falls into «أخرى»)', () => {
    expect([...known].filter(n => !placed.includes(n))).toEqual([]);
    const duplicates = placed.filter((n, i) => placed.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
  });

  it('has unique section and group keys', () => {
    const groupKeys = PERMISSION_SECTIONS.flatMap(s => s.groups.map(g => g.key));
    expect(new Set(PERMISSION_SECTIONS.map(s => s.key)).size).toBe(PERMISSION_SECTIONS.length);
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
  });
});
