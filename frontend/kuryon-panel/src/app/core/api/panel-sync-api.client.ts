import { Injectable } from '@angular/core';

export type PanelSyncSnapshot = {
  updatedAt: number;
  sourceId: string;
  payload: {
    ordersJson: string | null;
    couriersJson: string | null;
    packageSortJson: string | null;
  };
};

@Injectable({ providedIn: 'root' })
export class PanelSyncApiClient {
  constructor() {}

  getStateUrl(): string | null {
    return null;
  }

  async getState(): Promise<PanelSyncSnapshot | null> {
    return null;
  }

  async putState(_snapshot: PanelSyncSnapshot): Promise<void> {
    return;
  }
}
