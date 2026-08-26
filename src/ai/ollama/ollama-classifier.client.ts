import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../constants/env.constants';
import { Resilient } from '../../resilience';
import { OLLAMA_DEFAULTS, OLLAMA_ERRORS } from './ollama.constants';

export interface OllamaClassifierResult {
  rawText: string;
  latencyMs: number;
}

@Injectable()
export class OllamaClassifierClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    @InjectPinoLogger(OllamaClassifierClient.name) private readonly logger: PinoLogger,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>(ENV_VARIABLES.OLLAMA.BASE_URL, OLLAMA_DEFAULTS.BASE_URL);
    this.model = config.get<string>(ENV_VARIABLES.OLLAMA.CLASSIFIER_MODEL, OLLAMA_DEFAULTS.CLASSIFIER_MODEL);
  }

  @Resilient({ options: { timeoutMs: OLLAMA_DEFAULTS.TIMEOUT_MS } })
  async classify(systemPrompt: string, userContent: string): Promise<OllamaClassifierResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\n${userContent}`,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }

      const body = (await res.json()) as { response: string };
      return { rawText: body.response, latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.warn({ err }, OLLAMA_ERRORS.REQUEST_FAILED);
      throw new InternalServerErrorException(OLLAMA_ERRORS.REQUEST_FAILED, { cause: err });
    }
  }
}
