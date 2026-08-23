import { AuthInfo, OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import jwksClient, { type JwksClient } from 'jwks-rsa';

import { ENV_VARIABLES } from '../constants/env.constants';
import { AuthorizedUserRepository } from './authorized-user.repository';

@Injectable()
export class Auth0TokenVerifierService implements OAuthTokenVerifier {
  private readonly jwks: JwksClient;
  private readonly audience: string;
  private readonly issuer: string;

  constructor(
    config: ConfigService,
    private readonly authorizedUserRepository: AuthorizedUserRepository,
  ) {
    const domain = config.getOrThrow<string>(ENV_VARIABLES.AUTH0.DOMAIN);
    this.audience = config.getOrThrow<string>(ENV_VARIABLES.AUTH0.AUDIENCE);
    this.issuer = `https://${domain}/`;
    this.jwks = jwksClient({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: JwtPayload;
    try {
      payload = await this.verifyJwt(token);
    } catch (err) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Access token failed verification');
    }

    const sub = payload.sub;
    if (!sub) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Access token is missing a subject');

    const authorizedUser = await this.authorizedUserRepository.findBySub(sub);
    if (!authorizedUser) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'This user is not authorized');
    }

    return {
      token,
      clientId: sub,
      scopes: authorizedUser.scopes,
      expiresAt: payload.exp,
      extra: { tenantId: authorizedUser.tenantId },
    };
  }

  private verifyJwt(token: string): Promise<JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwks
            .getSigningKey(header.kid)
            .then((key) => callback(null, key.getPublicKey()))
            .catch((err: Error) => callback(err));
        },
        { audience: this.audience, issuer: this.issuer, algorithms: ['RS256'] },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            reject(err ?? new Error('Invalid token payload'));
            return;
          }
          resolve(decoded);
        },
      );
    });
  }
}
