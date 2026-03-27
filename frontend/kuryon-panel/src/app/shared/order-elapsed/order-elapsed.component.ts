import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { SharedOrderItem } from '../../core/services/order-state.service';
import { OrderElapsedTickerService } from '../../core/services/order-elapsed-ticker.service';
import { formatElapsedDuration, getOrderElapsedMs } from '../../core/utils/order-elapsed.util';

@Component({
  selector: 'app-order-elapsed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-elapsed.component.html',
  styleUrls: ['./order-elapsed.component.css']
})
export class OrderElapsedComponent {
  readonly order = input.required<SharedOrderItem>();

  private readonly ticker = inject(OrderElapsedTickerService);

  readonly display = computed(() => {
    this.ticker.tick();
    const o = this.order();
    const ms = getOrderElapsedMs(o, Date.now());
    if (ms !== null) {
      return { live: true, text: formatElapsedDuration(ms) };
    }
    return { live: false, text: o.eta };
  });
}
