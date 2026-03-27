import { environment } from '../../../environments/environment';

type RuntimeConfigShape = {
  enablePanelSync?: boolean;
  panelSyncPath?: string;
  panelSyncPollMs?: number;
};

function readRuntimeConfig(): RuntimeConfigShape {
  const g = globalThis as typeof globalThis & {
    __KURYON_RUNTIME_CONFIG__?: RuntimeConfigShape;
  };
  return g.__KURYON_RUNTIME_CONFIG__ ?? {};
}

export function isPanelSyncEnabled(): boolean {
  const runtimeFlag = readRuntimeConfig().enablePanelSync;
  if (typeof runtimeFlag === 'boolean') {
    return runtimeFlag;
  }
  return !!environment.enablePanelSync;
}

export function getPanelSyncPath(): string {
  const runtimePath = readRuntimeConfig().panelSyncPath;
  if (typeof runtimePath === 'string' && runtimePath.trim()) {
    return runtimePath.trim();
  }
  return '/api/state';
}

export function getPanelSyncPollMs(): number {
  const runtimePoll = readRuntimeConfig().panelSyncPollMs;
  if (typeof runtimePoll === 'number' && Number.isFinite(runtimePoll) && runtimePoll >= 1000) {
    return Math.floor(runtimePoll);
  }
  return 4000;
}
