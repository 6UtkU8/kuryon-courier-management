import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { getApiBaseUrl } from '../config/api-base-url';
import { LoggerService } from '../services/logger.service';

function isBackendRequest(url: string): boolean {
  const apiBaseUrl = getApiBaseUrl();
  return !!apiBaseUrl && url.startsWith(apiBaseUrl);
}

function isLoginRequest(url: string): boolean {
  return url.endsWith('/api/auth/admin-login') || url.endsWith('/api/auth/courier-login');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  const token = authService.getToken();
  const shouldAttachToken = !!token && isBackendRequest(req.url) && !isLoginRequest(req.url);
  const request = shouldAttachToken
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        if (isLoginRequest(req.url)) {
          return throwError(() => err);
        }

        logger.warn('Auth response intercepted', {
          url: req.url,
          method: req.method,
          status: err.status
        });

        authService.clearInvalidSession();
        void router.navigateByUrl('/login-select');
      }

      return throwError(() => err);
    })
  );
};
