export interface AuthResponse {
  token: string;
  expiresAt: string;
  fullName: string;
  email: string;
  /** اسم المنصب التنظيمي. لا يحمل معنى صلاحية بمفرده. */
  role: string;
  branchId: number | null;
  departmentId: number | null;
  officeId: number | null;
  permissions: string[];
}

export interface AuthUser {
  email: string;
  fullName: string;
  /** اسم المنصب التنظيمي. */
  role: string;
  branchId: number | null;
  departmentId: number | null;
  officeId: number | null;
  expiresAt: string;
  permissions: string[];
}
