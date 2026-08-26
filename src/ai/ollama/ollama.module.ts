import { Module } from '@nestjs/common';

import { OllamaClassifierClient } from './ollama-classifier.client';

@Module({
  providers: [OllamaClassifierClient],
  exports: [OllamaClassifierClient],
})
export class OllamaModule {}
