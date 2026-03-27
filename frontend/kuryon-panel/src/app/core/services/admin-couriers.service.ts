import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';

export interface AdminCourier {
  id: number;
  fullName: string;
  phoneNumber: string;
  email: string;
  isOnline: boolean;
  isOnBreak: boolean;
  breakReason: string | null;
  breakMinutes: number | null;
  vehicleType: string;
  region: string;
  status: string;
  createdAt: string;
}

export interface CreateCourierPayload {
  fullName: string;
  phoneNumber: string;
  email: string;
  vehicleType: string;
  region: string;
}

export interface UpdateCourierPayload extends CreateCourierPayload {}

export type CourierApiStatus = 'online' | 'offline' | 'break';

export interface UpdateCourierStatusPayload {
  status: CourierApiStatus;
  breakReason?: string;
  breakMinutes?: number;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
  }
}

function toFieldErrors(errorBody: unknown): Record<string, string[]> {
  if (!errorBody || typeof errorBody !== 'object' || !('errors' in errorBody)) {
    return {};
  }
  const raw = (errorBody as { errors?: unknown }).errors;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const mapped: Record<string, string[]> = {};
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      mapped[key] = value.map((item) => String(item));
      continue;
    }
    if (typeof value === 'string') {
      mapped[key] = [value];
    }
  }
  return mapped;
}

@Injectable({ providedIn: 'root' })
export class AdminCouriersService {
  constructor(private readonly http: HttpClient) {}

  async getCouriers(): Promise<AdminCourier[]> {
    const url = buildApiUrl('/api/admin/couriers');
    if (!url) {
      return [];
    }

    try {
      return await firstValueFrom(this.http.get<AdminCourier[]>(url));
    } catch (error: unknown) {
      throw this.mapError(error, 'Kurye listesi alınamadı.');
    }
  }

  async getCourierById(id: number): Promise<AdminCourier | null> {
    const url = buildApiUrl(`/api/admin/couriers/${id}`);
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.get<AdminCourier>(url));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      throw this.mapError(error, 'Kurye bilgisi alınamadı.');
    }
  }

  async createCourier(payload: CreateCourierPayload): Promise<AdminCourier | null> {
    const url = buildApiUrl('/api/admin/couriers');
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.post<AdminCourier>(url, payload));
    } catch (error: unknown) {
      throw this.mapError(error, 'Kurye oluşturulamadı.');
    }
  }

  async updateCourier(id: number, payload: UpdateCourierPayload): Promise<AdminCourier | null> {
    const url = buildApiUrl(`/api/admin/couriers/${id}`);
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.put<AdminCourier>(url, payload));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      throw this.mapError(error, 'Kurye güncellenemedi.');
    }
  }

  async updateCourierStatus(id: number, payload: UpdateCourierStatusPayload): Promise<AdminCourier> {
    const url = buildApiUrl(`/api/admin/couriers/${id}/status`);
    if (!url) {
      throw new ApiRequestError('API URL bulunamadı.', 0);
    }

    try {
      return await firstValueFrom(this.http.put<AdminCourier>(url, payload));
    } catch (error: unknown) {
      throw this.mapError(error, 'Kurye durumu güncellenemedi.');
    }
  }

  private mapError(error: unknown, fallbackMessage: string): ApiRequestError {
    if (error instanceof HttpErrorResponse) {
      return new ApiRequestError(
        this.resolveErrorMessage(error, fallbackMessage),
        error.status,
        toFieldErrors(error.error)
      );
    }
    return new ApiRequestError(fallbackMessage, 0);
  }

  private resolveErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
    const backendMessage =
      (typeof error.error === 'object' && error.error && 'message' in error.error
        ? String(error.error.message)
        : null) ?? null;

    if (backendMessage) {
      return backendMessage;
    }

    if (error.status === 404) {
      return 'Kurye bulunamadı.';
    }
    if (error.status === 400) {
      return 'İstek doğrulanamadı. Lütfen alanları kontrol edin.';
    }
    return fallbackMessage;
  }
}
