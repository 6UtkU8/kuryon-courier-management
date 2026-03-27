import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-panel-card',
  standalone: true,
  templateUrl: './panel-card.html',
  styleUrl: './panel-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() actionText = '';
  @Input() icon = '';
}