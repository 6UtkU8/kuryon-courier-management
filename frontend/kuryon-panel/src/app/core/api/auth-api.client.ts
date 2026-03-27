import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';
import {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthLogoutRequest,
  AuthMeResponse
} from '../models/auth-contract.types';
import { AUTH_API_PATHS } from './auth-api.paths';

@Injectable({ providedIn: 'root' })
export class AuthApiClient {
  constructor(private readonly http: HttpClient) {}

  getLoginUrl(): string | null {
    return buildApiUrl(AUTH_API_PATHS.login);
  }

  getMeUrl(): string | null {
    return buildApiUrl(AUTH_API_PATHS.me);
  }

  getLogoutUrl(): string | null {
    return buildApiUrl(AUTH_API_PATHS.logout);
  }

  async login(payload: AuthLoginRequest): Promise<AuthLoginResponse> {
    const url = this.getLoginUrl();
    if (!url) {
      throw new Error('AUTH_API_NOT_CONFIGURED');
    }
    return firstValueFrom(this.http.post<AuthLoginResponse>(url, payload));
  }

  async getMe(accessToken: string): Promise<AuthMeResponse> {
    const url = this.getMeUrl();
    if (!url) {
      throw new Error('AUTH_API_NOT_CONFIGURED');
    }
    return firstValueFrom(
      this.http.get<AuthMeResponse>(url, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${accessToken}`
        })
      })
    );
  }

  async logout(accessToken: string, payload?: AuthLogoutRequest): Promise<void> {
    const url = this.getLogoutUrl();
    if (!url) {
      throw new Error('AUTH_API_NOT_CONFIGURED');
    }
    await firstValueFrom(
      this.http.post<void>(url, payload ?? {}, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${accessToken}`
        })
      })
    );
  }
}
