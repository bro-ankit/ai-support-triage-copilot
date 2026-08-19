import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { KbSearchResultDto } from '../dto/kb-search-result.dto';
import { KbSearchQuery } from './kb-search.query';
import { KbSearchService } from './kb-search.service';

@QueryHandler(KbSearchQuery)
export class KbSearchQueryHandler implements IQueryHandler<KbSearchQuery, KbSearchResultDto[]> {
  constructor(
    @InjectPinoLogger(KbSearchQueryHandler.name) private readonly logger: PinoLogger,
    private readonly kbSearchService: KbSearchService,
  ) {}

  async execute(query: KbSearchQuery): Promise<KbSearchResultDto[]> {
    this.logger.debug({ q: query.q }, 'Executing KB search query');
    const chunks = await this.kbSearchService.search(query.q);
    return plainToInstance(KbSearchResultDto, chunks, { excludeExtraneousValues: true });
  }
}
