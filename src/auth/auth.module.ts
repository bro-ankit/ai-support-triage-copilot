import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { Auth0TokenVerifierService } from './auth0-token-verifier.service';
import { AuthorizedUserRepository } from './authorized-user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    JwtStrategy,
    AuthorizedUserRepository,
    Auth0TokenVerifierService,
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [AuthorizedUserRepository, Auth0TokenVerifierService, TenantContextService],
})
export class AuthModule {}
