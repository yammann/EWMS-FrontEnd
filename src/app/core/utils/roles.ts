/** يعرض اسم المنصب كما عرّفه مدير النظام؛ الاستثناء الوحيد هو الدور العام. */
export function roleLabel(roleName: string | null | undefined): string {
  return roleName?.toLowerCase() === 'superadmin' ? 'مدير النظام' : roleName ?? '';
}
