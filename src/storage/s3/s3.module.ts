import { S3Client } from '@aws-sdk/client-s3';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ENV_VARIABLES } from '../../constants/env.constants';
import { S3_CLIENT } from './s3.constants';

const S3_CLIENT_PROVIDER = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): S3Client =>
    new S3Client({
      endpoint: config.getOrThrow<string>(ENV_VARIABLES.S3.ENDPOINT),
      region: config.getOrThrow<string>(ENV_VARIABLES.S3.REGION),
      forcePathStyle: config.get<string>(ENV_VARIABLES.S3.FORCE_PATH_STYLE, 'true') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>(ENV_VARIABLES.S3.ACCESS_KEY_ID),
        secretAccessKey: config.getOrThrow<string>(ENV_VARIABLES.S3.SECRET_ACCESS_KEY),
      },
    }),
};

@Global()
@Module({
  providers: [S3_CLIENT_PROVIDER],
  exports: [S3_CLIENT],
})
export class S3Module {}
