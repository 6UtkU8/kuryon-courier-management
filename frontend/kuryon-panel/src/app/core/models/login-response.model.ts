export interface LoginResponse {
  success: boolean;
  message: string;
  userId: number | null;
  fullName: string | null;
  role: string | null;
  token: string | null;
}
