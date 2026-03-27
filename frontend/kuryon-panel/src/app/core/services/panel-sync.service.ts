import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PanelSyncService {
  constructor() {}

  start(): Promise<void> {
    return Promise.resolve();
  }
}
