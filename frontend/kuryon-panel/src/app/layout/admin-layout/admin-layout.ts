import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLayoutComponent {
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
      return;
    }

    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeMobileSidebar(): void {
    if (window.innerWidth <= 992) {
      this.mobileSidebarOpen = false;
    }
  }
}
