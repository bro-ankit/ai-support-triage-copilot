import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import pLimit from 'p-limit';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { PromptBoundaryUtil } from '../../../ai/prompt-boundary.util';
import { PromptInjectionGuardUtil } from '../../../ai/prompt-injection-guard.util';
import { CONTEXTUAL_CHUNK_DEFAULTS, CONTEXTUAL_CHUNK_SYSTEM_PROMPT } from './contextual-chunk.constants';
import type { KbChunk } from './kb-chunking.types';

@Injectable()
export class ContextualChunkService {
  constructor(
    @InjectPinoLogger(ContextualChunkService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) { }

  async enrichChunks(fullDocument: string, chunks: KbChunk[]): Promise<KbChunk[]> {
    this.logger.info({ chunkCount: chunks.length }, 'Generating contextual prefixes for chunks');

    const limit = pLimit(CONTEXTUAL_CHUNK_DEFAULTS.CONCURRENCY);
    return Promise.all(chunks.map((chunk) => limit(() => this.enrichChunk(fullDocument, chunk))));
  }

  private async enrichChunk(fullDocument: string, chunk: KbChunk): Promise<KbChunk> {
    const userMessage = [
      PromptBoundaryUtil.wrap('untrusted_kb_content', `Full document:\n${fullDocument}`),
      PromptBoundaryUtil.wrap('untrusted_kb_content', `Chunk:\n${chunk.content}`),
    ].join('\n\n');

    const { systemPrompt, canaryToken } = PromptInjectionGuardUtil.withCanary(CONTEXTUAL_CHUNK_SYSTEM_PROMPT);

    try {
      const context = await this.aiClient.generateText(systemPrompt, userMessage);

      if (PromptInjectionGuardUtil.detect(canaryToken, context)) {
        this.logger.warn({ chunkIndex: chunk.chunkIndex }, 'Contextual chunk generation failed the injection guard');
        return chunk;
      }

      return { ...chunk, content: `${context.trim()}\n\n${chunk.content}` };
    } catch (err) {
      this.logger.warn({ chunkIndex: chunk.chunkIndex, err }, 'Contextual chunk generation failed, using chunk as-is');
      return chunk;
    }
  }
}
