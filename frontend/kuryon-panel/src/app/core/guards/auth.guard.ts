import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

function checkAuth(): boolean | ReturnType<Router['createUrlTree']> {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  authService.clearInvalidSession();
  return router.createUrlTree(['/login-select']);
}

export const authGuard: CanActivateFn = () => checkAuth();
export const authChildGuard: CanActivateChildFn = () => checkAuth();
