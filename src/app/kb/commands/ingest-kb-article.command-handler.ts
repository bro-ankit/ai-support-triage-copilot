import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { IngestKbArticleResponseDto } from '../dto/ingest-kb-article-response.dto';
import { KbArticleIngestionService } from '../kb-article-ingestion.service';
import { IngestKbArticleCommand } from './ingest-kb-article.command';

@CommandHandler(IngestKbArticleCommand)
export class IngestKbArticleCommandHandler
  implements ICommandHandler<IngestKbArticleCommand, IngestKbArticleResponseDto> {
  constructor(private readonly kbArticleIngestionService: KbArticleIngestionService) {}

  execute(command: IngestKbArticleCommand): Promise<IngestKbArticleResponseDto> {
    const { dto } = command;
    return this.kbArticleIngestionService.ingest(dto.title, dto.sourceType, dto.rawContent);
  }
}
