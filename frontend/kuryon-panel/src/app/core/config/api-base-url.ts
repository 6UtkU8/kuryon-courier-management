import { environment } from '../../../environments/environment';

type RuntimeConfigShape = {
  apiBaseUrl?: string;
};

function readRuntimeConfig(): RuntimeConfigShape {
  const g = globalThis as typeof globalThis & {
    __KURYON_RUNTIME_CONFIG__?: RuntimeConfigShape;
  };
  return g.__KURYON_RUNTIME_CONFIG__ ?? {};
}

export function getApiBaseUrl(): string {
  const runtimeValue = readRuntimeConfig().apiBaseUrl;
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
    return runtimeValue.trim().replace(/\/+$/, '');
  }

  const envValue = (environment.apiBaseUrl || environment.apiUrl);
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue.trim().replace(/\/+$/, '');
  }

  return '';
}

export function isApiBaseUrlConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}

export function buildApiUrl(path: string): string | null {
  const base = getApiBaseUrl();
  if (!base) {
    return null;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
