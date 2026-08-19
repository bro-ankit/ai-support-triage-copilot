import { Global, Module } from '@nestjs/common';

import { S3StorageClient } from './s3/s3.client';
import { S3Module } from './s3/s3.module';
import { STORAGE_CLIENT } from './storage.constants';

@Global()
@Module({
  imports: [S3Module],
  providers: [S3StorageClient, { provide: STORAGE_CLIENT, useExisting: S3StorageClient }],
  exports: [STORAGE_CLIENT],
})
export class StorageModule {}
