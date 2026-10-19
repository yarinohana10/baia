import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { auth } from './auth';
import { fromNodeHeaders } from 'better-auth/node';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const needsRole = !!requiredRoles && requiredRoles.length > 0;

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      // Role checks must see the current DB role, not a role cached in the
      // session cookie (up to 5 min old) - e.g. right after a demotion.
      query: needsRole ? { disableCookieCache: true } : undefined,
    });

    if (!session) {
      throw new UnauthorizedException('Not authenticated');
    }

    request.user = session.user;
    request.session = session.session;

    if (needsRole) {
      const userRole = (session.user as { role?: string }).role ?? '';
      if (!requiredRoles.includes(userRole)) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
