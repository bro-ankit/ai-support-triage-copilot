import { SetMetadata } from '@nestjs/common';

import type { AuthScope } from '../auth.constants';

export const REQUIRED_SCOPES_KEY = Symbol('REQUIRED_SCOPES_KEY');

export const RequireScopes = (...scopes: AuthScope[]): MethodDecorator => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
