import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { DirectorPermissionKey } from '../models/director-permission.model';
import { DirectorPermissionService } from '../services/director-permission.service';

function resolveRequiredPermission(data: Record<string, unknown> | undefined): DirectorPermissionKey | null {
  const permission = data?.['permission'];
  if (typeof permission !== 'string') {
    return null;
  }
  return permission as DirectorPermissionKey;
}

function checkPermission(
  requiredPermission: DirectorPermissionKey | null
): boolean | ReturnType<Router['createUrlTree']> {
  if (!requiredPermission) {
    return true;
  }
  const router = inject(Router);
  const directorPermissions = inject(DirectorPermissionService);
  if (directorPermissions.can(requiredPermission)) {
    return true;
  }
  return router.createUrlTree([directorPermissions.getFirstAccessibleAdminRoute()]);
}

export const permissionGuard: CanActivateFn = (route) => {
  const required = resolveRequiredPermission(route.data);
  return checkPermission(required);
};

export const permissionChildGuard: CanActivateChildFn = (route) => {
  const required = resolveRequiredPermission(route.data);
  return checkPermission(required);
};
