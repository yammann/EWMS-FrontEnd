import { Department, Office } from '@core/models/ewms.models';
import { normalizePhone } from '@core/utils/phone';

/** أي حقول المكان تُعرض في نموذج الموظف ("needs…" هنا تعني: يُعرض الحقل لا أنه يُلزَم) */
export interface UserPlacement { needsBranch: boolean; needsDepartment: boolean; needsOffice: boolean; }

/** قيم نموذج الموظف التي تهم الإرسال والتحقق (إنشاء وتعديل بالشكل نفسه) */
export interface UserFormValue {
  fullName?: string | null; email?: string | null; personalIdNumber?: string | null; phoneNumber?: string | null; password?: string | null;
  roleId?: string | null; branchId?: string | null; departmentId?: string | null; officeId?: string | null;
}

/**
 * مكان الموظف (فرع / قسم / مكتب) يُحدَّد في نموذج الموظف لا في الدور، وكلها اختيارية —
 * مدير النظام (SuperAdmin) وحده لا يتبع لوحدة فتُخفى حقول المكان. الباكاند يشتق الأعلى من الأدق ويرفض التعارض.
 */
export function placementForRole(roleName: string | null | undefined): UserPlacement {
  const placed = roleName?.toLowerCase() !== 'superadmin';
  return { needsBranch: placed, needsDepartment: placed, needsOffice: placed };
}

/** التعارض فقط (قسم خارج الفرع المختار، أو مكتب خارج القسم المختار) — الفراغ مسموح */
export function hasAssignmentConflict(value: UserFormValue, departments: readonly Department[], offices: readonly Office[]): boolean {
  const department = departments.find(d => d.id === Number(value.departmentId));
  const office = offices.find(o => o.id === Number(value.officeId));
  return !!((value.branchId && department && department.branchId !== Number(value.branchId))
    || (value.departmentId && office && office.departmentId !== Number(value.departmentId)));
}

/**
 * جسم الإرسال: الإنشاء يُرسل كلمة المرور دائماً، والتعديل لا يُرسلها إلا إن أراد المستخدم تغييرها (ويُرسل isActive).
 * الرقم الذاتي يُنظَّف (قص + أحرف كبيرة) والهاتف يُطبَّع، ومكان الموظف لا يُرسل فارغه (الباكاند يعتبره بلا وحدة).
 */
export function buildUserFormData(value: UserFormValue, placement: UserPlacement, options: { editing: boolean; isActive?: boolean }): FormData {
  const form = new FormData();
  form.append('FullName', value.fullName ?? '');
  form.append('Email', value.email ?? '');
  form.append('PersonalIdNumber', (value.personalIdNumber ?? '').trim().toUpperCase());
  form.append('PhoneNumber', normalizePhone(value.phoneNumber));
  if (!options.editing) form.append('Password', value.password ?? '');
  form.append('RoleId', value.roleId ?? '');
  if (placement.needsBranch) {
    for (const [key, v] of [['BranchId', value.branchId], ['DepartmentId', value.departmentId], ['OfficeId', value.officeId]] as const)
      if (v) form.append(key, String(v));
  }
  if (options.editing) {
    form.append('IsActive', String(options.isActive ?? true));
    if (value.password) form.append('Password', value.password);
  }
  return form;
}
