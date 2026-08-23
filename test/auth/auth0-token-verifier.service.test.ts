import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

import { Auth0TokenVerifierService } from '../../src/auth/auth0-token-verifier.service';
import { AuthorizedUserRepository } from '../../src/auth/authorized-user.repository';
import { ENV_VARIABLES } from '../../src/constants/env.constants';
import { mockAuthorizedUserSelect } from '../__mocks__/auth/mock-authorized-user.select';
import { AssertUtils } from '../utils/assert.utils';

const DOMAIN = 'test-tenant.us.auth0.com';
const AUDIENCE = 'https://ai-support-triage-copilot/mcp';
const KID = 'test-key-id';
const SUB = 'auth0|test-user-id';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

jest.mock('jwks-rsa', () => {
  return jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({ getPublicKey: () => publicKey.export({ type: 'pkcs1', format: 'pem' }) }),
  }));
});

const signToken = (overrides: { payload?: Record<string, unknown>; expiresInSeconds?: number } = {}): string => {
  const { payload = {}, expiresInSeconds = 3600 } = overrides;
  return jwt.sign(
    { ...payload },
    privateKey,
    {
      algorithm: 'RS256',
      subject: SUB,
      audience: AUDIENCE,
      issuer: `https://${DOMAIN}/`,
      expiresIn: expiresInSeconds,
      keyid: KID,
    },
  );
};

describe('Auth0TokenVerifierService', () => {
  let sut: Auth0TokenVerifierService;
  let authorizedUserRepository: jest.Mocked<AuthorizedUserRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(Auth0TokenVerifierService)
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

  describe('Given a valid token from an authorized user', () => {
    describe('When verifyAccessToken is called', () => {
      test('Then it returns AuthInfo with the mapped tenantId and stored scopes', async () => {
        const tenantId = randomUUID();
        authorizedUserRepository.findBySub.mockResolvedValue(
          mockAuthorizedUserSelect({ tenantId, scopes: ['mcp', 'approve_actions'] }),
        );
        const token = signToken();

        const result = await sut.verifyAccessToken(token);

        expect(result).toEqual({
          token,
          clientId: SUB,
          scopes: ['mcp', 'approve_actions'],
          expiresAt: expect.any(Number),
          extra: { tenantId },
        });
      });
    });
  });

  describe('Given an expired token', () => {
    describe('When verifyAccessToken is called', () => {
      test('Then it throws an InvalidToken OAuthError', async () => {
        const token = signToken({ expiresInSeconds: -60 });

        await AssertUtils.assertError(async () => sut.verifyAccessToken(token), 'Access token failed verification');
      });
    });
  });

  describe('Given a malformed token', () => {
    describe('When verifyAccessToken is called', () => {
      test('Then it throws an InvalidToken OAuthError', async () => {
        await AssertUtils.assertError(
          async () => sut.verifyAccessToken('not-a-real-jwt'),
          'Access token failed verification',
        );
      });
    });
  });

  describe('Given a token whose subject has no authorized user record', () => {
    describe('When verifyAccessToken is called', () => {
      test('Then it throws an InvalidToken OAuthError', async () => {
        authorizedUserRepository.findBySub.mockResolvedValue(undefined);
        const token = signToken();

        await AssertUtils.assertError(async () => sut.verifyAccessToken(token), 'This user is not authorized');
      });
    });
  });

  describe('Given a token signed with the wrong audience', () => {
    describe('When verifyAccessToken is called', () => {
      test('Then it throws an InvalidToken OAuthError', async () => {
        const token = jwt.sign({}, privateKey, {
          algorithm: 'RS256',
          subject: SUB,
          audience: 'https://wrong-audience/mcp',
          issuer: `https://${DOMAIN}/`,
          expiresIn: 3600,
          keyid: KID,
        });

        await AssertUtils.assertError(async () => sut.verifyAccessToken(token), 'Access token failed verification');
      });
    });
  });
});
