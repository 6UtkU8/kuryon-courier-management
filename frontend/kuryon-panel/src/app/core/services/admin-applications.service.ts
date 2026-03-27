import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/api-base-url';

export interface CourierApplicationItem {
  id: number;
  fullName: string;
  phoneNumber: string;
  city: string;
  vehicleType: string;
  notes: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

type ReviewApplicationApiResponse =
  | CourierApplicationItem
  | {
      success: boolean;
      message: string;
      data: CourierApplicationItem;
    };

@Injectable({ providedIn: 'root' })
export class AdminApplicationsService {
  constructor(private readonly http: HttpClient) {}

  async getApplications(): Promise<CourierApplicationItem[]> {
    const url = buildApiUrl('/api/admin/applications');
    if (!url) {
      return [];
    }

    try {
      return await firstValueFrom(this.http.get<CourierApplicationItem[]>(url));
    } catch {
      return [];
    }
  }

  async reviewApplication(id: number, status: 'Pending' | 'Approved' | 'Rejected'): Promise<CourierApplicationItem | null> {
    const url = buildApiUrl(`/api/admin/applications/${id}/review`);
    if (!url) {
      return null;
    }

    try {
      const response = await firstValueFrom(this.http.post<ReviewApplicationApiResponse>(url, { status }));
      if ('data' in response) {
        return response.data;
      }
      return response;
    } catch {
      return null;
    }
  }
}
