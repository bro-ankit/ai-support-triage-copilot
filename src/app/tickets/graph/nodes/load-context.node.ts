import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketInvestigationContextService } from '../../orchestrator/ticket-investigation-context.service';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class LoadContextNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(LoadContextNode.name) private readonly logger: PinoLogger,
    private readonly contextService: TicketInvestigationContextService,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Loading ticket investigation context');
    const { ticket, attachmentText } = await this.contextService.load(state.ticketId);
    return {
      ticket,
      attachmentText,
      searchQuery: this.buildSearchQuery(ticket.subject, ticket.description, attachmentText),
    };
  }

  private buildSearchQuery(subject: string, description: string | null, attachmentText: string): string {
    return [subject, description, attachmentText].filter(Boolean).join('\n');
  }
}
