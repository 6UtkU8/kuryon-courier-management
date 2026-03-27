import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';
import { PackageApiStatus } from '../constants/package-status.constants';

export interface AdminPackage {
  id: number;
  trackingNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  description: string;
  paymentType: string;
  price: number;
  status: string;
  assignedCourierId: number | null;
  assignedCourierName: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface CreatePackagePayload {
  trackingNumber?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  description: string;
  paymentType: string;
  price: number;
}

export class PackageApiRequestError extends Error {
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
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.map((x) => String(x));
    } else if (typeof value === 'string') {
      out[key] = [value];
    }
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class AdminPackagesService {
  constructor(private readonly http: HttpClient) {}

  async getPackages(): Promise<AdminPackage[]> {
    const url = buildApiUrl('/api/admin/packages');
    if (!url) {
      return [];
    }

    try {
      return await firstValueFrom(this.http.get<AdminPackage[]>(url));
    } catch (error: unknown) {
      throw this.mapError(error, 'Paketler alınamadı.');
    }
  }

  async createPackage(payload: CreatePackagePayload): Promise<AdminPackage> {
    const url = buildApiUrl('/api/admin/packages');
    if (!url) {
      throw new PackageApiRequestError('API URL bulunamadı.', 0);
    }

    try {
      return await firstValueFrom(this.http.post<AdminPackage>(url, payload));
    } catch (error: unknown) {
      throw this.mapError(error, 'Paket oluşturulamadı.');
    }
  }

  async assignPackage(packageId: number, courierId: number): Promise<AdminPackage | null> {
    const url = buildApiUrl(`/api/admin/packages/${packageId}/assign/${courierId}`);
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.put<AdminPackage>(url, {}));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      throw this.mapError(error, 'Paket kurye ataması yapılamadı.');
    }
  }

  async updatePackageStatus(packageId: number, status: PackageApiStatus): Promise<AdminPackage> {
    const url = buildApiUrl(`/api/admin/packages/${packageId}/status`);
    if (!url) {
      throw new PackageApiRequestError('API URL bulunamadı.', 0);
    }

    try {
      return await firstValueFrom(this.http.put<AdminPackage>(url, { status }));
    } catch (error: unknown) {
      throw this.mapError(error, 'Paket durumu güncellenemedi.');
    }
  }

  private mapError(error: unknown, fallbackMessage: string): PackageApiRequestError {
    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        (typeof error.error === 'object' && error.error && 'message' in error.error
          ? String(error.error.message)
          : null) ?? fallbackMessage;
      return new PackageApiRequestError(backendMessage, error.status, toFieldErrors(error.error));
    }

    return new PackageApiRequestError(fallbackMessage, 0);
  }
}
