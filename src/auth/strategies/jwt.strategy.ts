import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ENV_VARIABLES } from '../../constants/env.constants';
import type { AuthenticatedUser } from '../auth.types';
import { AuthorizedUserRepository } from '../authorized-user.repository';

type Auth0AccessTokenPayload = {
  sub: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authorizedUserRepository: AuthorizedUserRepository,
  ) {
    const domain = config.getOrThrow<string>(ENV_VARIABLES.AUTH0.DOMAIN);

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.getOrThrow<string>(ENV_VARIABLES.AUTH0.AUDIENCE),
      issuer: `https://${domain}/`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: Auth0AccessTokenPayload): Promise<AuthenticatedUser> {
    const authorizedUser = await this.authorizedUserRepository.findBySub(payload.sub);
    if (!authorizedUser) throw new UnauthorizedException('This user is not authorized');

    return {
      userId: payload.sub,
      tenantId: authorizedUser.tenantId,
      scopes: authorizedUser.scopes,
    };
  }
}
