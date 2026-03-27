/**
 * Çapraz-sekme panel senkronu: aynı origin’de `localStorage` + `storage` olayı.
 * Aynı sekmede `setItem` bu sekmede `storage` tetiklemez; diğer sekmeler güncellenir.
 *
 * Çakışma: Eşzamanlı yazımda tarayıcıdaki son `setItem` kazanır; diğer sekme
 * `storage` ile o anlık JSON snapshot’ı alır (son yazar / snapshot tutarlılığı).
 */
export const COURIERS_STORAGE_KEY = 'kuryon_couriers_v1';
export const ORDERS_STORAGE_KEY = 'kuryon_orders_v1';
/** Kurye başına paket listesi sıralama tercihi */
export const COURIER_PACKAGE_SORT_KEY = 'kuryon_courier_package_sort_v1';
const SYNC_CHANNEL_NAME = 'kuryon_panel_sync_v1';
const memoryStorageFallback = new Map<string, string>();

type SyncChannelPayload = {
  key: string;
  valueJson: string;
};

let syncChannel: BroadcastChannel | null = null;

function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!syncChannel) {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
  return syncChannel;
}

function notifyCrossContextUpdate(key: string, valueJson: string): void {
  const channel = getSyncChannel();
  if (!channel) {
    return;
  }
  try {
    const payload: SyncChannelPayload = { key, valueJson };
    channel.postMessage(payload);
  } catch {
    // ignore channel failures
  }
}

export function readJsonFromLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      const memoryRaw = memoryStorageFallback.get(key) ?? null;
      if (memoryRaw == null) return null;
      return JSON.parse(memoryRaw) as T;
    }
    return JSON.parse(raw) as T;
  } catch {
    const memoryRaw = memoryStorageFallback.get(key) ?? null;
    if (memoryRaw == null) return null;
    try {
      return JSON.parse(memoryRaw) as T;
    } catch {
      return null;
    }
  }
}

export function writeJsonToLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  const serialized = JSON.stringify(value);
  memoryStorageFallback.set(key, serialized);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    // kota / gizli mod
  }
  notifyCrossContextUpdate(key, serialized);
}

export function subscribePanelSync(
  key: string,
  onValue: (valueJson: string) => void
): () => void {
  const channel = getSyncChannel();
  if (!channel) {
    return () => void 0;
  }

  const listener = (event: MessageEvent<SyncChannelPayload>): void => {
    const payload = event.data;
    if (!payload || payload.key !== key || typeof payload.valueJson !== 'string') {
      return;
    }
    onValue(payload.valueJson);
  };

  channel.addEventListener('message', listener);
  return () => {
    channel.removeEventListener('message', listener);
  };
}
