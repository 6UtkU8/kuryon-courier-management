import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';
import { UiNoticeService } from '../services/ui-notice.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly uiNotice = inject(UiNoticeService);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error('Unhandled application error', {
      message,
      stack
    });

    this.uiNotice.setCriticalMessage(UI_TEXTS.error.unexpected);
  }
}
