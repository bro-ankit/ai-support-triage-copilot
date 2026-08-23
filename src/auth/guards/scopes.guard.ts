import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth.types';
import type { AuthScope } from '../auth.constants';
import { REQUIRED_SCOPES_KEY } from '../decorators/require-scopes.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.get<AuthScope[]>(REQUIRED_SCOPES_KEY, context.getHandler());
    if (!requiredScopes || requiredScopes.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const hasAllScopes = requiredScopes.every((scope) => request.user.scopes.includes(scope));
    if (!hasAllScopes) {
      throw new ForbiddenException(`This action requires scope(s): ${requiredScopes.join(', ')}`);
    }

    return true;
  }
}
