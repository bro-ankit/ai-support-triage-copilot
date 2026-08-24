import { TestBed } from '@automock/jest';
import type { NextFunction, Request, Response } from 'express';

import { AUTH_SCOPES } from '../../src/auth/auth.constants';
import { Auth0TokenVerifierService } from '../../src/auth/auth0-token-verifier.service';
import { McpBearerAuthMiddleware } from '../../src/mcp/mcp-bearer-auth.middleware';

const mockRequireBearerAuthHandler = jest.fn();
const mockRequireBearerAuth = jest.fn((_options: unknown) => mockRequireBearerAuthHandler);

jest.mock('@modelcontextprotocol/express', () => ({
  requireBearerAuth: (options: unknown) => mockRequireBearerAuth(options),
}));

describe('McpBearerAuthMiddleware', () => {
  let sut: McpBearerAuthMiddleware;
  let verifier: jest.Mocked<Auth0TokenVerifierService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(McpBearerAuthMiddleware).compile();

    sut = unit;
    verifier = unitRef.get(Auth0TokenVerifierService);
  });

  describe('Given construction', () => {
    test('Then it builds the bearer-auth handler with the injected verifier and the mcp scope', () => {
      expect(mockRequireBearerAuth).toHaveBeenCalledWith({
        verifier,
        requiredScopes: [AUTH_SCOPES.MCP],
      });
    });
  });

  describe('Given use is called', () => {
    describe('When invoked with a request, response, and next', () => {
      test('Then it delegates to the underlying requireBearerAuth handler with the same arguments', () => {
        const req = { headers: {} } as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        sut.use(req, res, next);

        expect(mockRequireBearerAuthHandler).toHaveBeenCalledWith(req, res, next);
      });
    });
  });
});
