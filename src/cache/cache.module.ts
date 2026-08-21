import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

import { ENV_VARIABLES } from '../constants/env.constants';
import { CACHE_CLIENT } from './cache.constants';
import { REDIS_CLIENT } from './clients/redis-cache.constants';
import { RedisCacheService } from './clients/redis-cache.service';

const REDIS_CLIENT_PROVIDER: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<RedisClientType> => {
    const client = createClient({
      socket: {
        host: config.get<string>(ENV_VARIABLES.REDIS.HOST, 'localhost'),
        port: Number(config.get<string>(ENV_VARIABLES.REDIS.PORT, '6379')),
      },
      username: config.get<string>(ENV_VARIABLES.REDIS.USER),
      password: config.get<string>(ENV_VARIABLES.REDIS.PASSWORD),
    });
    await client.connect();
    return client;
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisCacheService, REDIS_CLIENT_PROVIDER, { provide: CACHE_CLIENT, useExisting: RedisCacheService }],
  exports: [CACHE_CLIENT],
})
export class CacheModule { }
