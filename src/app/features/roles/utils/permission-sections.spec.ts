import { AppPermission } from '@core/constants/access';
import { PERMISSION_SECTIONS } from './permission-sections';

/**
 * شجرة الصلاحيات في صفحة الأدوار تُكتب يدوياً، والصلاحية التي تُنسى فيها تظهر في «أخرى» فلا يجدها من يمنح الأدوار.
 * هذان الاختباران يجعلان النسيان خطأ بناء: كل صلاحية معرّفة في الواجهة موجودة في مجموعة، وكل اسم في مجموعة صلاحية معرّفة.
 */
describe('permission tree of the roles page', () => {
  const grouped = PERMISSION_SECTIONS.flatMap(s => s.groups.flatMap(g => g.names));
  const defined = Object.values(AppPermission) as string[];

  it('lists every permission the UI knows in some group', () => {
    const missing = defined.filter(name => !grouped.includes(name));
    expect(missing, `صلاحيات تظهر في «أخرى»: أضفها إلى مجموعتها في permission-sections.ts`).toEqual([]);
  });

  it('names no permission that does not exist, and lists none twice', () => {
    const unknown = grouped.filter(name => !defined.includes(name));
    expect(unknown, 'أسماء في المجموعات غير معرّفة في access.ts (خطأ إملائي أو صلاحية حُذفت)').toEqual([]);

    const repeated = grouped.filter((name, i) => grouped.indexOf(name) !== i);
    expect(repeated, 'صلاحية مكررة في أكثر من مجموعة').toEqual([]);
  });

  it('keeps group and section keys unique (they are used as track and storage keys)', () => {
    const sectionKeys = PERMISSION_SECTIONS.map(s => s.key);
    const groupKeys = PERMISSION_SECTIONS.flatMap(s => s.groups.map(g => g.key));
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length);
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
  });
});
