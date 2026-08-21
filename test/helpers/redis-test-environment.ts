import { type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import type { RedisClientType } from 'redis';

import { ENV_VARIABLES } from '../../src/constants/env.constants';
import { CacheModule } from '../../src/cache/cache.module';
import { REDIS_CLIENT } from '../../src/cache/clients/redis-cache.constants';

const REDIS_STACK_IMAGE = 'redis/redis-stack-server:7.4.0-v3';
const REDIS_PORT = 6379;

export class RedisTestEnvironment {
  private container!: StartedTestContainer;

  module!: TestingModule;

  async start(providers: Provider[] = [], imports: NonNullable<ModuleMetadata['imports']> = []): Promise<void> {
    this.container = await new GenericContainer(REDIS_STACK_IMAGE).withExposedPorts(REDIS_PORT).withReuse().start();

    const host = this.container.getHost();
    const port = String(this.container.getMappedPort(REDIS_PORT));
    const testConfigService = {
      get: (key: string, fallback?: string) => {
        if (key === ENV_VARIABLES.REDIS.HOST) return host;
        if (key === ENV_VARIABLES.REDIS.PORT) return port;
        return fallback;
      },
    };

    this.module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), CacheModule, ...imports],
      providers: [...providers],
    })
      .overrideProvider(ConfigService)
      .useValue(testConfigService)
      .compile();
  }

  async stop(): Promise<void> {
    const redisClient = this.module.get<RedisClientType>(REDIS_CLIENT, { strict: false });
    await redisClient.close();
    await this.module.close();
    await this.container.stop();
  }
}
