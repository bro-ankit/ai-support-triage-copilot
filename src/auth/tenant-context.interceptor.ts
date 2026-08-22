import type { UUID } from 'node:crypto';

import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import type { AuthenticatedClient } from './auth.types';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedClient }>();
    const tenantId = request.user?.tenantId ?? (request.auth?.extra?.['tenantId'] as UUID | undefined);
    if (!tenantId) return next.handle();

    return new Observable((subscriber) => {
      this.tenantContext.run(tenantId, () => next.handle().subscribe(subscriber));
    });
  }
}
