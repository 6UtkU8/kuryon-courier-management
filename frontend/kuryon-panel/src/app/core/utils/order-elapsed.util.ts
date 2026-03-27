import type { SharedOrderItem } from '../services/order-state.service';

/**
 * Sipariş oluşturulmasından itibaren geçen süre (ms).
 * Teslim edildiyse teslim anında donar (deliveredAtMs − createdAtMs).
 * Zaman damgası yoksa null (UI eski `eta` metnine döner).
 */
export function getOrderElapsedMs(order: SharedOrderItem, now: number): number | null {
  if (order.createdAtMs == null) {
    return null;
  }
  if (order.status === 'Teslim Edildi') {
    if (order.deliveredAtMs != null) {
      return Math.max(0, order.deliveredAtMs - order.createdAtMs);
    }
    return null;
  }
  return Math.max(0, now - order.createdAtMs);
}

/** mm:ss veya saat ≥1 ise h:mm:ss */
export function formatElapsedDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
