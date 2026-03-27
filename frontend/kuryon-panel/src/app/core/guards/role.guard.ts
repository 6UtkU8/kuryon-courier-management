import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user-session.model';

function resolveAllowedRoles(data: Record<string, unknown> | undefined): UserRole[] {
  const roles = data?.['roles'];
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is UserRole => {
    return role === 'admin' || role === 'courier' || role === 'store';
  });
}

async function checkAccess(
  allowedRoles: UserRole[]
): Promise<boolean | ReturnType<Router['createUrlTree']>> {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isStillAuthenticated = await authService.ensureAuthenticatedState();
  const session = authService.getSession();

  if (!isStillAuthenticated || !authService.isLoggedIn()) {
    authService.clearInvalidSession();
    return router.createUrlTree(['/login-select']);
  }

  if (allowedRoles.length === 0 || authService.hasRole(allowedRoles)) {
    return true;
  }

  if (!session) {
    authService.clearInvalidSession();
    return router.createUrlTree(['/login-select']);
  }

  return router.createUrlTree([authService.getDefaultRouteForRole(session.role)]);
}

export const roleGuard: CanActivateFn = (route) => {
  const allowedRoles = resolveAllowedRoles(route.data);
  return checkAccess(allowedRoles);
};

export const roleChildGuard: CanActivateChildFn = (childRoute) => {
  const allowedRoles = resolveAllowedRoles(childRoute.data);
  return checkAccess(allowedRoles);
};