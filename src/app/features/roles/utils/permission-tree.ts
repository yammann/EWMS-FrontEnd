import { Permission, Role } from '@core/models/ewms.models';
import { normalizePlaceText } from '@core/utils/places';
import { PERMISSION_SECTIONS, PermissionSectionDef } from './permission-sections';

export interface PermissionGroup { key: string; title: string; items: Permission[]; }
export interface PermissionSection { key: string; title: string; groups: PermissionGroup[]; items: Permission[]; }

/**
 * شجرة الصلاحيات من قائمة الخادم: الأقسام الثابتة ← مجموعاتها ← صلاحياتها الموجودة فعلاً،
 * وما لا ينتمي لمجموعة يظهر في قسم «أخرى» فلا يضيع.
 */
export function buildPermissionSections(all: readonly Permission[], definitions: readonly PermissionSectionDef[] = PERMISSION_SECTIONS): PermissionSection[] {
  const byName = new Map(all.map(p => [p.name, p]));
  const used = new Set<string>();

  const sections: PermissionSection[] = definitions.map(s => {
    const groups = s.groups
      .map(g => ({ key: g.key, title: g.title, items: g.names.map(n => byName.get(n)).filter((p): p is Permission => !!p) }))
      .filter(g => g.items.length);
    return { key: s.key, title: s.title, groups, items: groups.flatMap(g => g.items) };
  }).filter(s => s.items.length);

  sections.forEach(s => s.items.forEach(p => used.add(p.name)));
  const others = all.filter(p => !used.has(p.name));
  if (others.length) sections.push({ key: 'others', title: 'أخرى', groups: [{ key: 'others', title: 'أخرى', items: others }], items: others });
  return sections;
}

/** دور طابق البحث، وهل بالاسم أم بصلاحية يملكها (via = أول صلاحيتين مطابقتين) */
export interface RoleMatch { role: Role; byName: boolean; via: string; }

/**
 * مطابقة الأدوار: أدوار اسمها يحوي النص؛ وإن لم يوجد دور بهذا الاسم فالأدوار التي تملك صلاحية تطابقه
 * (باسمها أو وصفها العربي). الطبيعي: بلا همزات وتاء مربوطة وتشكيل (normalizePlaceText).
 */
export function matchRoles(roles: readonly Role[], query: string): RoleMatch[] {
  const q = normalizePlaceText(query);
  if (!q) return [];
  const has = (text: string | null | undefined) => normalizePlaceText(text ?? '').includes(q);
  const byName = roles.filter(r => has(r.name));
  if (byName.length) return byName.map(role => ({ role, byName: true, via: '' }));
  return roles.filter(r => (r.permissions ?? []).some(p => has(p.name) || has(p.description)))
    .map(role => ({
      role, byName: false,
      via: (role.permissions ?? []).filter(p => has(p.name) || has(p.description)).slice(0, 2).map(p => p.name).join('، ')
    }));
}

/** ملخص الأدوار لبطاقات أعلى الصفحة */
export function roleStats(roles: readonly Role[], permissions: readonly Permission[]) {
  const totalPermissions = permissions.length;
  const totalRoles = roles.length;
  const totalAssigned = roles.reduce((sum, role) => sum + (role.permissions?.length ?? 0), 0);
  return {
    totalRoles,
    totalPermissions,
    avgPermissions: totalRoles ? Math.round(totalAssigned / totalRoles) : 0,
    fullRoles: roles.filter(role => (role.permissions?.length ?? 0) === totalPermissions).length
  };
}

/** تحديد أو إلغاء مجموعة معرّفات من القائمة الحالية بلا المساس بالباقي ولا التكرار */
export function withSelection(current: readonly number[], ids: readonly number[], checked: boolean): number[] {
  const group = new Set(ids);
  const rest = current.filter(id => !group.has(id));
  return checked ? [...rest, ...group] : rest;
}
