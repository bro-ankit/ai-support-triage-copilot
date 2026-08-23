import { applyDecorators, UseGuards } from '@nestjs/common';

import type { AuthScope } from '../auth.constants';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from './require-scopes.decorator';

export const RequireAuth = (...scopes: AuthScope[]): MethodDecorator =>
  applyDecorators(UseGuards(JwtAuthGuard, ScopesGuard), RequireScopes(...scopes));
