import {
  AuthLoginRequest,
  AuthLoginResponse,
  UserRole
} from '../models/auth-contract.types';
import { getDemoAuthUsers } from './demo-auth-users';
import { normalizeTurkishPhoneDigits } from '../utils/phone-normalize';

function matchesDemoIdentifier(role: UserRole, identifier: string): boolean {
  const demoUsers = getDemoAuthUsers();
  if (!demoUsers) {
    return false;
  }

  if (role === 'admin') {
    return identifier.trim().toLowerCase() === demoUsers.admin.email.toLowerCase();
  }

  if (role === 'courier') {
    return (
      normalizeTurkishPhoneDigits(identifier) === normalizeTurkishPhoneDigits(demoUsers.courier.phone)
    );
  }

  return normalizeTurkishPhoneDigits(identifier) === normalizeTurkishPhoneDigits(demoUsers.store.phone);
}

function matchesDemoPassword(role: UserRole, password: string): boolean {
  const demoUsers = getDemoAuthUsers();
  if (!demoUsers) {
    return false;
  }

  if (role === 'admin') {
    return password.trim() === demoUsers.admin.password;
  }
  if (role === 'courier') {
    return password.trim() === demoUsers.courier.password;
  }
  return password.trim() === demoUsers.store.password;
}

export function tryDemoAuthLogin(
  request: AuthLoginRequest & { role: UserRole }
): AuthLoginResponse | null {
  const demoUsers = getDemoAuthUsers();
  if (!demoUsers) {
    console.log('[auth:demo] login failed', {
      role: request.role,
      normalizedInput:
        request.role === 'admin'
          ? request.identifier.trim().toLowerCase()
          : normalizeTurkishPhoneDigits(request.identifier),
      matchedUser: false,
      passwordMatch: false
    });
    return null;
  }

  const normalizedInput =
    request.role === 'admin'
      ? request.identifier.trim().toLowerCase()
      : normalizeTurkishPhoneDigits(request.identifier);
  const matchedUser = matchesDemoIdentifier(request.role, request.identifier);
  if (!matchedUser) {
    console.log('[auth:demo] login failed', {
      role: request.role,
      normalizedInput,
      matchedUser,
      passwordMatch: false
    });
    return null;
  }
  const passwordMatch = matchesDemoPassword(request.role, request.password);
  if (!passwordMatch) {
    console.log('[auth:demo] login failed', {
      role: request.role,
      normalizedInput,
      matchedUser,
      passwordMatch
    });
    return null;
  }

  const nameByRole: Record<UserRole, string> = {
    admin: 'Demo Admin',
    courier: 'Demo Kurye',
    store: 'Demo Dukkan'
  };

  return {
    accessToken: `demo-${Date.now()}`,
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: `demo-${request.role}`,
      name: nameByRole[request.role],
      email: request.role === 'admin' ? request.identifier.trim().toLowerCase() : null,
      phone: request.role === 'admin' ? null : request.identifier.trim(),
      role: request.role
    }
  };
}
