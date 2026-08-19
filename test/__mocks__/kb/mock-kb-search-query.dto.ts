import type { KbSearchQueryDto } from '../../../src/app/kb/dto/kb-search-query.dto';

export const mockKbSearchQueryDto = (args: Partial<KbSearchQueryDto> = {}): KbSearchQueryDto => ({
  q: 'why is the checkout webhook not idempotent',
  ...args,
});
