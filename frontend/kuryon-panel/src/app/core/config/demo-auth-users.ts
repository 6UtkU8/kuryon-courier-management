import { environment } from '../../../environments/environment';

export type DemoAuthUsers = {
  admin: {
    email: string;
    password: string;
  };
  courier: {
    phone: string;
    password: string;
  };
  store: {
    phone: string;
    password: string;
  };
};

const DEV_DEMO_AUTH_USERS: DemoAuthUsers = {
  admin: {
    email: 'admin@kuryon.com',
    password: '123456'
  },
  courier: {
    phone: '5551112233',
    password: '123456'
  },
  store: {
    phone: '05557778899',
    password: '123456'
  }
};

type RuntimeConfigShape = {
  enableDemoAuth?: boolean;
};

function readRuntimeConfig(): RuntimeConfigShape {
  const g = globalThis as typeof globalThis & {
    __KURYON_RUNTIME_CONFIG__?: RuntimeConfigShape;
  };
  return g.__KURYON_RUNTIME_CONFIG__ ?? {};
}

export function isDemoAuthRuntimeEnabled(): boolean {
  const runtimeFlag = readRuntimeConfig().enableDemoAuth;
  return environment.enableDemoAuth || runtimeFlag === true;
}

export function getDemoAuthUsers(): DemoAuthUsers | null {
  if (!isDemoAuthRuntimeEnabled()) {
    return null;
  }

  return DEV_DEMO_AUTH_USERS;
}
