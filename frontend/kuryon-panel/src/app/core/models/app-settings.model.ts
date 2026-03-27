export type SettingsCategoryId =
  | 'general'
  | 'operations'
  | 'automation'
  | 'mapLocation'
  | 'regionPricing'
  | 'financePayment'
  | 'shiftBreak'
  | 'notifications'
  | 'brandAppearance'
  | 'securityLogs'
  | 'directors';

export type AccentPreset = 'cyan' | 'violet' | 'emerald' | 'amber';
export type CardDensity = 'comfortable' | 'compact';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type PricingMode = 'zone_flat' | 'distance_tier' | 'hybrid';
export type AddressVisibilityMode = 'after_accept' | 'after_pickup';

export interface AppSettings {
  general: {
    companyName: string;
    supportEmail: string;
    supportPhone: string;
    officeAddress: string;
  };
  operations: {
    orderCancelWindowMinutes: number;
    restaurantPhoneRequired: boolean;
    courierSeesAddressAfterPickup: boolean;
    maxActivePackagesPerCourier: number;
  };
  automation: {
    autoAssignCourier: boolean;
    autoAssignDelaySeconds: number;
    smartPriorityEnabled: boolean;
  };
  mapLocation: {
    liveRefreshSeconds: number;
    showCourierTrails: boolean;
    addressVisibilityMode: AddressVisibilityMode;
  };
  regionPricing: {
    pricingMode: PricingMode;
    baseDeliveryFee: number;
    distanceStepKm: number;
  };
  financePayment: {
    defaultPaymentView: 'cash' | 'card' | 'mixed';
    highlightOnlinePayments: boolean;
  };
  shiftBreak: {
    allowBreakRequests: boolean;
    peakHoursBreakRestriction: boolean;
    defaultBreakMinutes: number;
  };
  notifications: {
    enableSound: boolean;
    enablePush: boolean;
    enableEmailSummary: boolean;
  };
  brandAppearance: {
    accentPreset: AccentPreset;
    cardDensity: CardDensity;
    useGlassSurfaces: boolean;
  };
  securityLogs: {
    logLevel: LogLevel;
    retainDays: number;
    showSensitiveEvents: boolean;
  };
  meta: {
    updatedAtIso: string;
    updatedBy: string;
  };
}

export const APP_SETTINGS_STORAGE_KEY = 'kuryon.app.settings.v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    companyName: 'Kuryon',
    supportEmail: 'destek@kuryon.com',
    supportPhone: '0555 123 45 67',
    officeAddress: 'Kayseri / Melikgazi'
  },
  operations: {
    orderCancelWindowMinutes: 10,
    restaurantPhoneRequired: false,
    courierSeesAddressAfterPickup: false,
    maxActivePackagesPerCourier: 4
  },
  automation: {
    autoAssignCourier: true,
    autoAssignDelaySeconds: 35,
    smartPriorityEnabled: true
  },
  mapLocation: {
    liveRefreshSeconds: 20,
    showCourierTrails: true,
    addressVisibilityMode: 'after_accept'
  },
  regionPricing: {
    pricingMode: 'zone_flat',
    baseDeliveryFee: 65,
    distanceStepKm: 2
  },
  financePayment: {
    defaultPaymentView: 'mixed',
    highlightOnlinePayments: true
  },
  shiftBreak: {
    allowBreakRequests: true,
    peakHoursBreakRestriction: true,
    defaultBreakMinutes: 15
  },
  notifications: {
    enableSound: true,
    enablePush: true,
    enableEmailSummary: true
  },
  brandAppearance: {
    accentPreset: 'cyan',
    cardDensity: 'comfortable',
    useGlassSurfaces: true
  },
  securityLogs: {
    logLevel: 'info',
    retainDays: 30,
    showSensitiveEvents: false
  },
  meta: {
    updatedAtIso: new Date().toISOString(),
    updatedBy: 'Admin'
  }
};
