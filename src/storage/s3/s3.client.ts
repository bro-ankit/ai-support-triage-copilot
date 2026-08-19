import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../constants/env.constants';
import type { IStorageClient } from '../storage.interface';
import { S3_CLIENT, S3_STORAGE_DEFAULTS } from './s3.constants';

@Injectable()
export class S3StorageClient implements IStorageClient {
  private readonly bucketName: string;

  constructor(
    @InjectPinoLogger(S3StorageClient.name) private readonly logger: PinoLogger,
    @Inject(S3_CLIENT) private readonly client: S3Client,
    config: ConfigService,
  ) {
    this.bucketName = config.getOrThrow<string>(ENV_VARIABLES.S3.BUCKET_NAME);
  }

  async getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
    this.logger.debug({ key, mimeType }, 'Generating presigned upload URL');
    const command = new PutObjectCommand({ Bucket: this.bucketName, Key: key, ContentType: mimeType });
    return getSignedUrl(this.client, command, {
      expiresIn: S3_STORAGE_DEFAULTS.PRESIGNED_UPLOAD_URL_EXPIRY_SECONDS,
    });
  }

  async getObject(key: string): Promise<Buffer> {
    this.logger.debug({ key }, 'Fetching object from S3');
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }
}
