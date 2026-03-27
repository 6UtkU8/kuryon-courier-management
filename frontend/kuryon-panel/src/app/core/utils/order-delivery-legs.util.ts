import type { SharedOrderItem } from '../services/order-state.service';

/** Teslim edilmiş sipariş için kurye aşama süreleri (ms); eksik timestamp’te null. */
export type CourierDeliveryLegDurations = {
  totalMs: number | null;
  /** Oluşturma → Firmadayım */
  toFirmadayimMs: number | null;
  /** Firmadayım → Yola çıktım */
  firmadayimToYolaMs: number | null;
  /** Yola çıktım → Teslim */
  yolaToDeliveredMs: number | null;
};

export function computeCourierDeliveryLegDurations(order: SharedOrderItem): CourierDeliveryLegDurations {
  if (order.status !== 'Teslim Edildi') {
    return {
      totalMs: null,
      toFirmadayimMs: null,
      firmadayimToYolaMs: null,
      yolaToDeliveredMs: null
    };
  }
  const c = order.createdAtMs ?? null;
  const f = order.firmadayimAtMs ?? null;
  const y = order.yolaCiktimAtMs ?? null;
  const d = order.deliveredAtMs ?? null;

  if (d == null) {
    return {
      totalMs: null,
      toFirmadayimMs: null,
      firmadayimToYolaMs: null,
      yolaToDeliveredMs: null
    };
  }

  const totalMs = c != null ? d - c : null;
  const toFirmadayimMs = c != null && f != null ? f - c : null;
  const firmadayimToYolaMs = f != null && y != null ? y - f : null;
  const yolaToDeliveredMs = y != null ? d - y : null;

  return {
    totalMs,
    toFirmadayimMs,
    firmadayimToYolaMs,
    yolaToDeliveredMs
  };
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) {
    return '—';
  }
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h} sa ${m} dk ${s} sn`.replace(/\s+0 sn$/, '').trim();
  }
  if (m > 0 && s > 0) {
    return `${m} dk ${s} sn`;
  }
  if (m > 0) {
    return `${m} dk`;
  }
  return `${s} sn`;
}
