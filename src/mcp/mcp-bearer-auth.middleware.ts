import { Injectable, type NestMiddleware } from '@nestjs/common';
import { requireBearerAuth } from '@modelcontextprotocol/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AUTH_SCOPES } from '../auth/auth.constants';
import { Auth0TokenVerifierService } from '../auth/auth0-token-verifier.service';

@Injectable()
export class McpBearerAuthMiddleware implements NestMiddleware {
  private readonly handler: RequestHandler;

  constructor(verifier: Auth0TokenVerifierService) {
    this.handler = requireBearerAuth({ verifier, requiredScopes: [AUTH_SCOPES.MCP] });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res, next);
  }
}
