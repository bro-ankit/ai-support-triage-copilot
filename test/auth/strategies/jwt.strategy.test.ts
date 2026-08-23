import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { AuthorizedUserRepository } from '../../../src/auth/authorized-user.repository';
import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import { ENV_VARIABLES } from '../../../src/constants/env.constants';
import { mockAuthorizedUserSelect } from '../../__mocks__';
import { AssertUtils } from '../../utils/assert.utils';

const DOMAIN = 'test-tenant.us.auth0.com';
const AUDIENCE = 'https://ai-support-triage-copilot/mcp';
const SUB = 'auth0|test-user-id';

describe('JwtStrategy', () => {
  let sut: JwtStrategy;
  let authorizedUserRepository: jest.Mocked<AuthorizedUserRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(JwtStrategy)
      .mock(ConfigService)
      .using({
        getOrThrow: (key: string) => {
          if (key === ENV_VARIABLES.AUTH0.DOMAIN) return DOMAIN;
          if (key === ENV_VARIABLES.AUTH0.AUDIENCE) return AUDIENCE;
          throw new Error(`Unexpected config key: ${key}`);
        },
      })
      .compile();

    sut = unit;
    authorizedUserRepository = unitRef.get(AuthorizedUserRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given a payload whose sub is an authorized user', () => {
    describe('When validate is called', () => {
      test('Then it returns an AuthenticatedUser with the mapped tenantId and stored scopes', async () => {
        const tenantId = randomUUID();
        authorizedUserRepository.findBySub.mockResolvedValue(
          mockAuthorizedUserSelect({ tenantId, scopes: ['mcp', 'approve_actions'] }),
        );

        const result = await sut.validate({ sub: SUB });

        expect(authorizedUserRepository.findBySub).toHaveBeenCalledWith(SUB);
        expect(result).toEqual({ userId: SUB, tenantId, scopes: ['mcp', 'approve_actions'] });
      });
    });
  });

  describe('Given an authorized user with no scopes', () => {
    describe('When validate is called', () => {
      test('Then it returns an AuthenticatedUser with an empty scopes array', async () => {
        authorizedUserRepository.findBySub.mockResolvedValue(mockAuthorizedUserSelect({ scopes: [] }));

        const result = await sut.validate({ sub: SUB });

        expect(result.scopes).toEqual([]);
      });
    });
  });

  describe('Given a payload whose sub has no authorized user record', () => {
    describe('When validate is called', () => {
      test('Then it throws UnauthorizedException', async () => {
        authorizedUserRepository.findBySub.mockResolvedValue(undefined);

        await AssertUtils.assertError(async () => sut.validate({ sub: SUB }), 'This user is not authorized', 401);
      });
    });
  });
});
