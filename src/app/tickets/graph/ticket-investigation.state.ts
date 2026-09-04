import type { UUID } from 'node:crypto';

import { Annotation } from '@langchain/langgraph';

import type { KbChunkSelect } from '../../../schema/kb-chunks.schema';
import type { TicketInvestigationSelect } from '../../../schema/ticket-investigations.schema';
import type { TicketSelect } from '../../../schema/tickets.schema';
import type { DiagnoseTicketResponse } from '../agents/diagnose-ticket.agent';
import type { SimilarPastTicketCase } from '../memory/ticket-episodic-memory.types';
import type { TicketInvestigationResult } from '../ticket-investigation-result.types';

export const TicketInvestigationState = Annotation.Root({
  ticketId: Annotation<UUID>,
  ticket: Annotation<TicketSelect>({ default: () => undefined as unknown as TicketSelect, reducer: (_, b) => b }),
  attachmentText: Annotation<string>({ default: () => '', reducer: (_, b) => b }),
  searchQuery: Annotation<string>({ default: () => '', reducer: (_, b) => b }),
  pastCases: Annotation<SimilarPastTicketCase[]>({ default: () => [], reducer: (_, b) => b }),
  kbChunks: Annotation<KbChunkSelect[]>({ default: () => [], reducer: (_, b) => b }),
  retrievedChunkIds: Annotation<UUID[]>({ default: () => [], reducer: (_, b) => b }),
  citedChunkIds: Annotation<UUID[]>({ default: () => [], reducer: (_, b) => b }),
  diagnosis: Annotation<DiagnoseTicketResponse | null>({ default: () => null, reducer: (_, b) => b }),
  earlyResult: Annotation<TicketInvestigationResult | undefined>({ default: () => undefined, reducer: (_, b) => b }),
  investigation: Annotation<TicketInvestigationSelect | undefined>({ default: () => undefined, reducer: (_, b) => b }),
});

export type TicketInvestigationGraphState = typeof TicketInvestigationState.State;
