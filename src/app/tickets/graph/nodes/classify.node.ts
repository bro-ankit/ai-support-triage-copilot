import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketClassificationStepService } from '../../orchestrator/steps/ticket-classification-step.service';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class ClassifyNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(ClassifyNode.name) private readonly logger: PinoLogger,
    private readonly classificationStep: TicketClassificationStepService,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running classify node');
    await this.classificationStep.run(state.ticket, state.attachmentText);
    return {};
  }
}
