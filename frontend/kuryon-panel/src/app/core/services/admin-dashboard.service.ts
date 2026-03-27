import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';

export interface AdminDashboardMetrics {
  totalCouriers: number;
  onlineCouriers: number;
  offlineCouriers: number;
  onBreakCouriers: number;
  totalPackages: number;
  assignedPackages: number;
  deliveredToday: number;
  pendingApplications: number;
  totalRevenueToday: number;
}

export class DashboardApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  constructor(private readonly http: HttpClient) {}

  async getMetrics(): Promise<AdminDashboardMetrics> {
    const url = buildApiUrl('/api/admin/dashboard/metrics');
    if (!url) {
      throw new DashboardApiError('API URL bulunamadı.', 0);
    }

    try {
      return await firstValueFrom(this.http.get<AdminDashboardMetrics>(url));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const backendMessage =
          (typeof error.error === 'object' && error.error && 'message' in error.error
            ? String(error.error.message)
            : null) ?? 'Dashboard metrikleri yüklenemedi.';
        throw new DashboardApiError(backendMessage, error.status);
      }

      throw new DashboardApiError('Dashboard metrikleri yüklenemedi.', 0);
    }
  }
}
