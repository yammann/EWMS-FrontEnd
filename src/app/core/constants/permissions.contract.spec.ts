import { readFileSync } from 'node:fs';
import { AppPermission } from './access';

/**
 * أسماء الصلاحيات في الواجهة (access.ts) تطابق كتالوج الباكاند تماماً. الملف contract/permissions.json نسخة من لقطة الباكاند
 * (npm run contract:sync). صلاحية أُضيفت هناك ولم تُعرَّف هنا = زر أو صفحة لا يظهران لأحد بصمت؛ واسم هنا بلا مقابل = زر لا يظهر أبداً.
 */
describe('permission names match the backend catalog', () => {
  const backend: { permissions: string[]; anyOf: Record<string, string[]> } = JSON.parse(readFileSync('contract/permissions.json', 'utf8'));
  const ui = Object.values(AppPermission) as string[];

  it('defines every backend permission', () => {
    const missing = backend.permissions.filter(name => !ui.includes(name));
    expect(missing, 'صلاحيات في الباكاند غير معرّفة في access.ts (أضفها إلى AppPermission وإلى شجرة صفحة الأدوار)').toEqual([]);
  });

  it('defines no permission the backend does not have', () => {
    const unknown = ui.filter(name => !backend.permissions.includes(name));
    expect(unknown, 'أسماء في access.ts لا وجود لها في الباكاند (خطأ إملائي أو صلاحية حُذفت)').toEqual([]);
  });

  it('uses each permission name as its own key', () => {
    const wrong = Object.entries(AppPermission).filter(([key, value]) => key !== value).map(([key]) => key);
    expect(wrong).toEqual([]);
  });

  it('does not mistake an any-of policy for a permission', () => {
    const shadow = Object.keys(backend.anyOf).filter(name => ui.includes(name));
    expect(shadow, 'سياسة «أيّ من» ليست صلاحية تُمنح للأدوار').toEqual([]);
  });
});
