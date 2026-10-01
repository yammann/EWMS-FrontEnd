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
  /** مستوى الدور: SuperAdmin | BranchManager | Manager | OfficeManager | Emp — الاسم حر والمنطق يعتمد المستوى */
  level: string;
  permissions: Permission[];
}

export interface User {
  officeId: number | null;
  officeName: string;
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  roleName: string;
  departmentId: number | null;
  departmentName: string;
  branchId: number | null;
  branchName: string;
  isActive: boolean;
  createdAt: string;
}
