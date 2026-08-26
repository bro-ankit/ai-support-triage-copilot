import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../../constants/env.constants';
import type { TicketSelect } from '../../../schema/tickets.schema';
import type { ClassifyTicketResponse } from './ticket-classification.contract';
import { TICKET_CLASSIFIER_CHAIN } from './ticket-classifier.constants';
import type { ITicketClassifier } from './ticket-classifier.interface';

const DEFAULT_SHADOW_SAMPLE_RATE = 0.2;
const TICKET_CLASSIFIER_ERRORS = {
  CHAIN_EXHAUSTED: 'No classifier in the chain produced a result',
} as const;

@Injectable()
export class TicketClassifierAgent {
  private readonly shadowSampleRate: number;

  constructor(
    @InjectPinoLogger(TicketClassifierAgent.name) private readonly logger: PinoLogger,
    @Inject(TICKET_CLASSIFIER_CHAIN) private readonly classifiers: ITicketClassifier[],
    config: ConfigService,
  ) {
    this.shadowSampleRate = config.get<number>(ENV_VARIABLES.OLLAMA.SHADOW_SAMPLE_RATE, DEFAULT_SHADOW_SAMPLE_RATE);
  }

  async classify(ticket: TicketSelect, attachmentText: string): Promise<ClassifyTicketResponse> {
    for (const [index, classifier] of this.classifiers.entries()) {
      const result = await classifier.classify(ticket, attachmentText);
      if (result === null) continue;

      this.logger.info({ ticketId: ticket.id, source: classifier.name }, 'Ticket classified');

      const isTrustedArbiter = index === this.classifiers.length - 1;
      if (!isTrustedArbiter && Math.random() < this.shadowSampleRate) void this.shadowCheck(ticket, attachmentText, result);

      return result;
    }

    throw new InternalServerErrorException(TICKET_CLASSIFIER_ERRORS.CHAIN_EXHAUSTED);
  }

  private async shadowCheck(ticket: TicketSelect, attachmentText: string, result: ClassifyTicketResponse): Promise<void> {
    const arbiter = this.classifiers[this.classifiers.length - 1];

    try {
      const arbiterResult = await arbiter.classify(ticket, attachmentText);
      if (arbiterResult === null) return;

      const agree = arbiterResult.category === result.category && arbiterResult.priority === result.priority;
      this.logger.info(
        {
          ticketId: ticket.id,
          agree,
          resultCategory: result.category,
          resultPriority: result.priority,
          arbiterCategory: arbiterResult.category,
          arbiterPriority: arbiterResult.priority,
        },
        'Ticket classifier chain shadow comparison',
      );
    } catch (err) {
      this.logger.warn({ ticketId: ticket.id, err }, 'Shadow comparison against the trusted arbiter failed, ignoring');
    }
  }
}
