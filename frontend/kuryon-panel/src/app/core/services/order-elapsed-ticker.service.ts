import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, startWith } from 'rxjs';

/**
 * Tüm sipariş süre sayaçları için tek saniyelik tetikleyici (çoklu setInterval yerine).
 */
@Injectable({
  providedIn: 'root'
})
export class OrderElapsedTickerService {
  readonly tick = toSignal(interval(1000).pipe(startWith(0)), { initialValue: 0 });
}
