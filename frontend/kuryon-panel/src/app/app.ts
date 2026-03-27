import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';

import { AdminNewOrderDrawerComponent } from './shared/admin-new-order-drawer/admin-new-order-drawer.component';
import { UiNoticeService } from './core/services/ui-notice.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { AppTitleService } from './core/services/app-title.service';
import { DevProfilerService } from './core/dev/dev-profiler.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AdminNewOrderDrawerComponent, AsyncPipe, NgIf],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly criticalMessage$;
  readonly toast$;

  constructor(
    private readonly uiNotice: UiNoticeService,
    private readonly appSettings: AppSettingsService,
    private readonly appTitle: AppTitleService,
    private readonly devProfiler: DevProfilerService
  ) {
    this.criticalMessage$ = this.uiNotice.criticalMessage$;
    this.toast$ = this.uiNotice.toast$;
    this.appSettings.getSnapshot();
    this.appTitle.init();
    this.devProfiler.isEnabled();
  }

  dismissToast(id?: number): void {
    this.uiNotice.dismissToast(id);
  }
}