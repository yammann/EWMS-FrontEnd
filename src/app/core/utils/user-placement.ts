/**
 * التبعية التنظيمية المطلوبة لكل مستوى دور (Role.level لا الاسم) — نفس القاعدة في الباكاند (Application/Features/Users/UserPlacement.cs):
 * SuperAdmin لا يتبع لفرع/قسم/مكتب، رئيس الفرع لفرع فقط، رئيس القسم لفرع وقسم، وباقي الأدوار للثلاثة.
 */
export interface UserPlacement {
  needsBranch: boolean;
  needsDepartment: boolean;
  needsOffice: boolean;
}

export function placementForRole(level: string | null | undefined): UserPlacement {
  switch ((level ?? '').toLowerCase()) {
    case 'superadmin': return { needsBranch: false, needsDepartment: false, needsOffice: false };
    case 'branchmanager': return { needsBranch: true, needsDepartment: false, needsOffice: false };
    case 'manager': return { needsBranch: true, needsDepartment: true, needsOffice: false };
    default: return { needsBranch: true, needsDepartment: true, needsOffice: true };
  }
}

/** رئيس الفرع و SuperAdmin لا يتبعان لقسم → لا يقدّمان إجازات من النظام */
export function canRequestVacation(roleName: string | null | undefined): boolean {
  return placementForRole(roleName).needsDepartment;
}
