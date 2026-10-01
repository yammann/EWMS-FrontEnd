export interface AuthResponse {
  token: string;
  expiresAt: string;
  fullName: string;
  email: string;
  /** مستوى الدور (SuperAdmin | BranchManager | Manager | OfficeManager | Emp) — تعتمد عليه الواجهة في المنطق */
  role: string;
  /** اسم الدور كما كتبه المدير — للعرض فقط */
  roleName?: string;
  permissions: string[];
  /** نطاق الصلاحيات ذات النطاق: الاسم ← 1 سجلاته، 2 مكتبه، 3 قسمه، 4 فرعه، 5 كل المؤسسة */
  permissionScopes?: Record<string, number>;
}

export interface AuthUser {
  email: string;
  fullName: string;
  /** مستوى الدور (SuperAdmin | BranchManager | Manager | OfficeManager | Emp) — تعتمد عليه الواجهة في المنطق */
  role: string;
  /** اسم الدور كما كتبه المدير — للعرض فقط */
  roleName?: string;
  expiresAt: string;
  permissions: string[];
  /** نطاق الصلاحيات ذات النطاق: الاسم ← 1 سجلاته، 2 مكتبه، 3 قسمه، 4 فرعه، 5 كل المؤسسة */
  permissionScopes?: Record<string, number>;
}