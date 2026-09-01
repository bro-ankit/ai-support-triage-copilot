import { randomUUID } from 'node:crypto';

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { STORAGE_CLIENT } from '../../../storage/storage.constants';
import type { IStorageClient } from '../../../storage/storage.interface';
import { RequestKbArticlePdfUploadResponseDto } from '../dto/request-kb-article-pdf-upload-response.dto';
import { REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS } from './request-kb-article-pdf-upload.constants';
import { RequestKbArticlePdfUploadCommand } from './request-kb-article-pdf-upload.command';

@CommandHandler(RequestKbArticlePdfUploadCommand)
export class RequestKbArticlePdfUploadCommandHandler
  implements ICommandHandler<RequestKbArticlePdfUploadCommand, RequestKbArticlePdfUploadResponseDto> {
  constructor(
    @InjectPinoLogger(RequestKbArticlePdfUploadCommandHandler.name) private readonly logger: PinoLogger,
    @Inject(STORAGE_CLIENT) private readonly storageClient: IStorageClient,
  ) {}

  async execute(command: RequestKbArticlePdfUploadCommand): Promise<RequestKbArticlePdfUploadResponseDto> {
    const objectKey = `kb-articles/${randomUUID()}-${command.dto.filename}`;

    const { url: uploadUrl, fields: uploadFields } = await this.storageClient.getPresignedUploadUrl(
      objectKey,
      REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MIME_TYPE,
      REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MAX_SIZE_BYTES,
    );

    this.logger.info({ objectKey }, 'Presigned KB article PDF upload URL issued');

    return plainToInstance(RequestKbArticlePdfUploadResponseDto, { uploadUrl, uploadFields, objectKey }, { excludeExtraneousValues: true });
  }
}
