import type { KbChunkInsert } from '../../../schema/kb-chunks.schema';

export type KbChunkToInsert = Omit<KbChunkInsert, 'contentTsv' | 'createdAt'>;
