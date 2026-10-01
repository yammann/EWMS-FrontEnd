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
}