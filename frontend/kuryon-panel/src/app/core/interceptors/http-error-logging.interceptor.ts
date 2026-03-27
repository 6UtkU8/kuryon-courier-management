import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';
import { AUTH_API_PATHS } from '../api/auth-api.paths';

function isImportantError(err: HttpErrorResponse): boolean {
  if (err.status >= 500) return true;
  if (err.url?.includes(AUTH_API_PATHS.login) || err.url?.includes(AUTH_API_PATHS.me) || err.url?.includes(AUTH_API_PATHS.logout)) {
    return err.status >= 400;
  }
  return false;
}

export const httpErrorLoggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && isImportantError(err)) {
        logger.error('HTTP request failed', {
          method: req.method,
          url: req.url,
          status: err.status,
          statusText: err.statusText,
          message: err.message
        });
      }
      return throwError(() => err);
    })
  );
};
