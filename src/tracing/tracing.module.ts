import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { TracingDiscoveryService } from './tracing-discovery.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [TracingDiscoveryService],
})
export class TracingModule {}
