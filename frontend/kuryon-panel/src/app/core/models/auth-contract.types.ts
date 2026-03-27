export type UserRole = 'admin' | 'courier' | 'store';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

export interface AuthLoginRequest {
  identifier: string;
  password: string;
  role?: UserRole;
}

export interface AuthLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface AuthMeResponse {
  user: AuthUser;
}

export interface AuthLogoutRequest {
  allSessions?: boolean;
}

export interface AuthLogoutResponse {
  success: boolean;
  message?: string;
}

export interface AuthErrorResponse {
  code: string;
  message: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  role: UserRole;
  identifier: string;
  fullName: string;
  userId: number | null;
  loginAt: number;
  contextCourierId?: number;
  contextStoreId?: string;
}
