import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../../resilience';
import { TICKET_PROPOSED_ACTIONS } from '../../../schema/ticket-investigations.schema';
import type { TicketSelect } from '../../../schema/tickets.schema';
import type { DiagnoseTicketResponse } from './diagnose-ticket.agent';

const PROPOSE_TICKET_ACTION_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['action', 'reasoning'],
};

const PROPOSE_TICKET_ACTION_RESPONSE_SCHEMA = z.object({
  action: z.enum(TICKET_PROPOSED_ACTIONS),
  reasoning: z.string(),
});

export type ProposeTicketActionResponse = z.infer<typeof PROPOSE_TICKET_ACTION_RESPONSE_SCHEMA>;

const SYSTEM_PROMPT =
  'You are a Proposed-Action agent for a customer support triage system. You are given a ticket and a ' +
  `diagnosis already synthesized by another agent. Propose exactly one action (${TICKET_PROPOSED_ACTIONS.join(', ')}) ` +
  'with a reasoning grounded in the diagnosis. Use "reply_only" when the diagnosis gives the customer ' +
  'a clear answer but nothing needs to be refunded, credited, or escalated. You are propose-only: you ' +
  'never execute anything yourself, every action you propose requires explicit human approval before ' +
  'it can be carried out.';

@Injectable()
export class ProposeTicketActionAgent {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) {}

  @TrackAiUsage('TICKET_PROPOSE_ACTION')
  @Resilient({ options: { timeoutMs: 30_000 } })
  async propose(ticket: TicketSelect, diagnosis: DiagnoseTicketResponse): Promise<ProposeTicketActionResponse> {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `Subject: ${ticket.subject}\n` +
      `Description: ${ticket.description ?? '(none provided)'}\n\n` +
      `Diagnosis (confidence ${diagnosis.confidence}): ${diagnosis.diagnosis}`;

    const raw = await this.aiClient.generateStructured(prompt, PROPOSE_TICKET_ACTION_SCHEMA);

    try {
      return PROPOSE_TICKET_ACTION_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Propose Ticket Action agent returned a malformed response', {
        cause: err,
      });
    }
  }
}
