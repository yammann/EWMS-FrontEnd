export interface AuthResponse {
  token: string;
  expiresAt: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthUser {
  email: string;
  fullName: string;
  role: string;
  expiresAt: string;
  permissions: string[];
}