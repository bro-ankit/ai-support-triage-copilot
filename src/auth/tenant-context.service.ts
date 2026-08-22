import { AsyncLocalStorage } from 'node:async_hooks';
import type { UUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<UUID>();

  run<T>(tenantId: UUID, fn: () => T): T {
    return this.als.run(tenantId, fn);
  }

  getTenantId(): UUID {
    const tenantId = this.als.getStore();
    if (!tenantId) {
      throw new Error('TenantContextService.getTenantId() called outside of a tenant-scoped request');
    }
    return tenantId;
  }
}
