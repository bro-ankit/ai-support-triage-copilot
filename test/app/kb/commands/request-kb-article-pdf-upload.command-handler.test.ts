import { TestBed } from '@automock/jest';

import { RequestKbArticlePdfUploadCommand } from '../../../../src/app/kb/commands/request-kb-article-pdf-upload.command';
import { RequestKbArticlePdfUploadCommandHandler } from '../../../../src/app/kb/commands/request-kb-article-pdf-upload.command-handler';
import { REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS } from '../../../../src/app/kb/commands/request-kb-article-pdf-upload.constants';
import { RequestKbArticlePdfUploadRequestDto } from '../../../../src/app/kb/dto/request-kb-article-pdf-upload-request.dto';
import { STORAGE_CLIENT } from '../../../../src/storage/storage.constants';
import type { IStorageClient } from '../../../../src/storage/storage.interface';

const REQUEST: RequestKbArticlePdfUploadRequestDto = { filename: 'postmortem.pdf' };
const PRESIGNED_UPLOAD = { url: 'https://s3.example.com/bucket', fields: { key: 'kb-articles/x-postmortem.pdf' } };

describe('RequestKbArticlePdfUploadCommandHandler Unit Test', () => {
  let sut: RequestKbArticlePdfUploadCommandHandler;
  let storageClient: jest.Mocked<IStorageClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RequestKbArticlePdfUploadCommandHandler).compile();

    sut = unit;
    storageClient = unitRef.get(STORAGE_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storageClient.getPresignedUploadUrl.mockResolvedValue(PRESIGNED_UPLOAD);
  });

  describe('Given execute', () => {
    describe('When called with a filename', () => {
      test('Then it presigns an upload under an object key derived from the filename and returns the upload details', async () => {
        const result = await sut.execute(new RequestKbArticlePdfUploadCommand(REQUEST));

        expect(storageClient.getPresignedUploadUrl).toHaveBeenCalledWith(
          expect.stringMatching(/^kb-articles\/.+-postmortem\.pdf$/),
          REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MIME_TYPE,
          REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MAX_SIZE_BYTES,
        );

        const [objectKey] = storageClient.getPresignedUploadUrl.mock.calls[0];
        expect(result).toEqual({
          uploadUrl: PRESIGNED_UPLOAD.url,
          uploadFields: PRESIGNED_UPLOAD.fields,
          objectKey,
        });
      });
    });
  });
});
