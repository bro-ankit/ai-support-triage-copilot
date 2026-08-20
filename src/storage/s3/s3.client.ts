import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../constants/env.constants';
import type { IStorageClient, PresignedUpload } from '../storage.interface';
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

  async getPresignedUploadUrl(key: string, mimeType: string, maxSizeBytes: number): Promise<PresignedUpload> {
    this.logger.debug({ key, mimeType, maxSizeBytes }, 'Generating presigned upload post');
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [['content-length-range', 0, maxSizeBytes], { 'Content-Type': mimeType }],
      Fields: { 'Content-Type': mimeType },
      Expires: S3_STORAGE_DEFAULTS.PRESIGNED_UPLOAD_URL_EXPIRY_SECONDS,
    });
    return { url, fields };
  }

  async getObject(key: string): Promise<Buffer> {
    this.logger.debug({ key }, 'Fetching object from S3');
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }
}
