import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';
import { AdminPackage } from './admin-packages.service';

export interface CourierProfile {
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

export interface CourierReport {
  deliveredCount: number;
  deliveredToday?: number;
  totalRevenue: number;
  averagePrice: number;
  activePackageCount?: number;
  currentStatus?: string;
}

export interface CourierStatusPayload {
  isOnline?: boolean;
  isOnBreak?: boolean;
  breakReason?: string;
  breakMinutes?: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class CourierPanelService {
  constructor(private readonly http: HttpClient) {}

  async getMyProfile(): Promise<CourierProfile | null> {
    const url = buildApiUrl('/api/courier/me');
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.get<CourierProfile>(url));
    } catch {
      return null;
    }
  }

  async getMyPackages(): Promise<AdminPackage[]> {
    const url = buildApiUrl('/api/courier/my-packages');
    if (!url) {
      return [];
    }

    try {
      return await firstValueFrom(this.http.get<AdminPackage[]>(url));
    } catch {
      return [];
    }
  }

  async getMyHistory(): Promise<AdminPackage[]> {
    const url = buildApiUrl('/api/courier/my-history');
    if (!url) {
      return [];
    }

    try {
      return await firstValueFrom(this.http.get<AdminPackage[]>(url));
    } catch {
      return [];
    }
  }

  async getMyReport(): Promise<CourierReport | null> {
    const url = buildApiUrl('/api/courier/my-report');
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.get<CourierReport>(url));
    } catch {
      return null;
    }
  }

  async updateMyStatus(payload: CourierStatusPayload): Promise<CourierProfile | null> {
    const url = buildApiUrl('/api/courier/status');
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.put<CourierProfile>(url, payload));
    } catch {
      return null;
    }
  }

  async deliverPackage(packageId: number): Promise<AdminPackage | null> {
    const url = buildApiUrl(`/api/courier/packages/${packageId}/deliver`);
    if (!url) {
      return null;
    }

    try {
      return await firstValueFrom(this.http.put<AdminPackage>(url, {}));
    } catch {
      return null;
    }
  }
}
