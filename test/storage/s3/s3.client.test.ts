import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { S3StorageClient } from '../../../src/storage/s3/s3.client';
import { S3_CLIENT } from '../../../src/storage/s3/s3.constants';

jest.mock('@aws-sdk/s3-request-presigner');

const BUCKET_NAME = 'support-triage-attachments';
const OBJECT_KEY = 'tickets/ticket-1/screenshot.png';
const MIME_TYPE = 'image/png';
const PRESIGNED_URL = 'https://s3.example.com/presigned-upload';

describe('S3StorageClient Unit Test', () => {
  let sut: S3StorageClient;
  let s3Client: jest.Mocked<S3Client>;
  const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

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

  describe('Given getPresignedUploadUrl, When called with a key and mime type', () => {
    test('Then it requests a signed URL for a PutObjectCommand scoped to the bucket and key', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(PRESIGNED_URL);

      const result = await sut.getPresignedUploadUrl(OBJECT_KEY, MIME_TYPE);

      expect(result).toBe(PRESIGNED_URL);
      const [client, command] = mockGetSignedUrl.mock.calls[0];
      expect(client).toBe(s3Client);
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toEqual({
        Bucket: BUCKET_NAME,
        Key: OBJECT_KEY,
        ContentType: MIME_TYPE,
      });
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
