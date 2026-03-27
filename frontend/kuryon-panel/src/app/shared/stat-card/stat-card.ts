import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type StatTheme = 'blue' | 'green' | 'orange' | 'red' | 'purple';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.html',
  styleUrls: ['./stat-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() trend = '';
  @Input() theme: StatTheme = 'blue';
}