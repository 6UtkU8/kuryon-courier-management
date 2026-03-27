import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { buildApiUrl } from '../config/api-base-url';
import { AdminLoginRequest } from '../models/admin-login-request.model';
import { CourierLoginRequest } from '../models/courier-login-request.model';
import { LoginResponse } from '../models/login-response.model';
import { UserRole, UserSession } from '../models/user-session.model';

const LOCAL_STORAGE_KEY = 'kuryon_user_session';

export type AuthLoginResult = {
  ok: boolean;
  errorMessage?: string;
  session?: UserSession;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<UserSession | null>(this.readSession());
  readonly session$ = this.sessionSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  async adminLogin(payload: AdminLoginRequest): Promise<AuthLoginResult> {
    const url = buildApiUrl('/api/auth/admin-login');
    if (!url) {
      return { ok: false, errorMessage: 'API base URL tanimli degil.' };
    }

    return this.performLogin(url, payload);
  }

  async courierLogin(payload: CourierLoginRequest): Promise<AuthLoginResult> {
    const url = buildApiUrl('/api/auth/courier-login');
    if (!url) {
      return { ok: false, errorMessage: 'API base URL tanimli degil.' };
    }

    return this.performLogin(url, payload);
  }

  async loginWithCredentials(
    role: UserRole,
    identifier: string,
    password: string
  ): Promise<AuthLoginResult> {
    if (role === 'admin') {
      return this.adminLogin({ email: identifier.trim(), password: password.trim() });
    }

    if (role === 'courier') {
      return this.courierLogin({ phoneNumber: identifier.trim(), password: password.trim() });
    }

    return { ok: false, errorMessage: 'Store login backend tarafinda aktif degil.' };
  }

  async logout(): Promise<void> {
    this.clearLocalSession();
  }

  restoreSession(): Promise<boolean> {
    return Promise.resolve(this.isLoggedIn());
  }

  async ensureAuthenticatedState(): Promise<boolean> {
    return this.isLoggedIn();
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    if (this.isTokenExpired(token)) {
      this.clearInvalidSession();
      return false;
    }
    return true;
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  getAccessToken(): string | null {
    return this.getToken();
  }

  getRole(): UserRole | null {
    return this.getSession()?.role ?? null;
  }

  getUserName(): string | null {
    return this.getSession()?.fullName ?? null;
  }

  getSession(): UserSession | null {
    return this.sessionSubject.value;
  }

  hasRole(roles: UserRole[]): boolean {
    const role = this.getRole();
    return !!role && roles.includes(role);
  }

  clearInvalidSession(): void {
    this.clearLocalSession();
  }

  getDefaultRouteForRole(role: UserRole): string {
    if (role === 'admin') {
      return '/dashboard';
    }
    if (role === 'courier') {
      return '/courier-panel';
    }
    return '/login-select';
  }

  private async performLogin(url: string, payload: AdminLoginRequest | CourierLoginRequest): Promise<AuthLoginResult> {
    try {
      const response = await firstValueFrom(this.http.post<LoginResponse>(url, payload));
      if (!response.success || !response.token || !response.role) {
        return { ok: false, errorMessage: response.message || 'Giris basarisiz.' };
      }

      if (response.role !== 'admin' && response.role !== 'courier') {
        return { ok: false, errorMessage: 'Desteklenmeyen rol.' };
      }

      const session: UserSession = {
        accessToken: response.token,
        tokenType: 'Bearer',
        role: response.role,
        identifier: response.role === 'admin'
          ? (payload as AdminLoginRequest).email
          : (payload as CourierLoginRequest).phoneNumber,
        fullName: response.fullName ?? '',
        userId: response.userId ?? null,
        loginAt: Date.now()
      };

      this.commitSession(session);
      return { ok: true, session };
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const backendMessage =
          typeof error.error?.message === 'string' ? error.error.message : '';
        return { ok: false, errorMessage: backendMessage || 'Giris bilgileri hatali.' };
      }

      return { ok: false, errorMessage: 'Giris servisine ulasilamadi.' };
    }
  }

  private commitSession(session: UserSession): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private clearLocalSession(): void {
    this.clearClientSessionKeys();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    this.sessionSubject.next(null);
  }

  private readSession(): UserSession | null {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UserSession>;
      if (
        !parsed.accessToken ||
        !parsed.role ||
        !parsed.identifier ||
        typeof parsed.loginAt !== 'number'
      ) {
        return null;
      }

      if (this.isTokenExpired(parsed.accessToken)) {
        return null;
      }

      if (parsed.role !== 'admin' && parsed.role !== 'courier' && parsed.role !== 'store') {
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        tokenType: 'Bearer',
        role: parsed.role,
        identifier: parsed.identifier,
        fullName: parsed.fullName ?? '',
        userId: typeof parsed.userId === 'number' ? parsed.userId : null,
        loginAt: parsed.loginAt
      };
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.readJwtPayload(token);
    const exp = payload?.['exp'];
    if (typeof exp !== 'number') {
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    return exp <= nowSec;
  }

  private readJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) {
      return null;
    }

    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private clearClientSessionKeys(): void {
    const keysToClear = [
      'kuryon_couriers_v1',
      'kuryon_orders_v1',
      'kuryon_courier_package_sort_v1'
    ];
    for (const key of keysToClear) {
      localStorage.removeItem(key);
    }
  }
}
