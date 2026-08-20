import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { S3StorageClient } from '../../../src/storage/s3/s3.client';
import { S3_CLIENT, S3_STORAGE_DEFAULTS } from '../../../src/storage/s3/s3.constants';

jest.mock('@aws-sdk/s3-presigned-post');

const BUCKET_NAME = 'support-triage-attachments';
const OBJECT_KEY = 'tickets/ticket-1/screenshot.png';
const MIME_TYPE = 'image/png';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PRESIGNED_POST = { url: 'https://s3.example.com/support-triage-attachments', fields: { key: OBJECT_KEY } };

describe('S3StorageClient Unit Test', () => {
  let sut: S3StorageClient;
  let s3Client: jest.Mocked<S3Client>;
  const mockCreatePresignedPost = createPresignedPost as jest.MockedFunction<typeof createPresignedPost>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(S3StorageClient)
      .mock(ConfigService)
      .using({ getOrThrow: (key: string) => (key === 'S3_BUCKET_NAME' ? BUCKET_NAME : 'unused') })
      .compile();

    sut = unit;
    s3Client = unitRef.get<S3Client>(S3_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given getPresignedUploadUrl, When called with a key, mime type, and max size', () => {
    test('Then it requests a presigned POST scoped to the bucket, key, mime type, and size limit', async () => {
      mockCreatePresignedPost.mockResolvedValueOnce(PRESIGNED_POST);

      const result = await sut.getPresignedUploadUrl(OBJECT_KEY, MIME_TYPE, MAX_SIZE_BYTES);

      expect(result).toEqual(PRESIGNED_POST);
      expect(mockCreatePresignedPost.mock.calls).toEqual([
        [
          s3Client,
          {
            Bucket: BUCKET_NAME,
            Key: OBJECT_KEY,
            Conditions: [['content-length-range', 0, MAX_SIZE_BYTES], { 'Content-Type': MIME_TYPE }],
            Fields: { 'Content-Type': MIME_TYPE },
            Expires: S3_STORAGE_DEFAULTS.PRESIGNED_UPLOAD_URL_EXPIRY_SECONDS,
          },
        ],
      ]);
    });
  });

  describe('Given getObject, When the object exists', () => {
    test('Then it fetches the object from the configured bucket and returns its bytes as a Buffer', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      s3Client.send.mockResolvedValueOnce({
        Body: { transformToByteArray: jest.fn().mockResolvedValue(bytes) },
      } as never);

      const result = await sut.getObject(OBJECT_KEY);

      expect(result).toEqual(Buffer.from(bytes));
      const command = s3Client.send.mock.calls[0][0] as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: BUCKET_NAME, Key: OBJECT_KEY });
    });
  });

  describe('Given getObject, When the response body is empty', () => {
    test('Then it returns an empty Buffer', async () => {
      s3Client.send.mockResolvedValueOnce({ Body: undefined } as never);

      const result = await sut.getObject(OBJECT_KEY);

      expect(result).toEqual(Buffer.from([]));
    });
  });
});
