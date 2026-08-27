import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { ResilienceModule } from './resilience';
import { StorageModule } from './storage/storage.module';
import { TracingModule } from './tracing/tracing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ResilienceModule,
    DatabaseModule,
    AiModule,
    MetricsModule,
    TracingModule,
    StorageModule,
    CacheModule,
    AuthModule,
  ],
})
export class CoreInfraModule {}
