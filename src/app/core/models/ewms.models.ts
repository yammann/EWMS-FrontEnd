export interface Branch {
  id: number;
  name: string;
  description: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  branchId: number;
  branchName: string;
}

export interface Permission {
  id: number;
  name: string;
  description: string;
}

export interface Office {
  id: number;
  name: string;
  description: string;
  departmentId: number;
  departmentName: string;
  branchId: number;
  branchName: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

export interface User {
  officeId: number | null;
  officeName: string;
  id: number;
  fullName: string;
  email: string;
  /** الرقم الذاتي (فريد، اختياري) */
  personalIdNumber: string | null;
  /** رقم التواصل (هاتف سوري، اختياري) */
  phoneNumber: string | null;
  roleId: number;
  roleName: string;
  branchId: number | null;
  branchName: string;
  departmentId: number | null;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
}
