import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { EPISODIC_MEMORY_DEFAULTS } from '../../../../src/app/tickets/memory/episodic-memory.constants';
import { EpisodicMemoryService } from '../../../../src/app/tickets/memory/episodic-memory.service';
import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { mockSimilarPastCase, mockTicketInvestigationResult, mockTicketSelect } from '../../../__mocks__';

const EXCLUDE_TICKET_ID = randomUUID();
const QUERY = 'Charged twice for order #4821';
const EMBEDDING = [0.1, 0.2, 0.3];
const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });

describe('EpisodicMemoryService Unit Test', () => {
  let sut: EpisodicMemoryService;
  let aiClient: jest.Mocked<IAiClient>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(EpisodicMemoryService).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
  });

  describe('Given recall', () => {
    describe('When called', () => {
      test('Then it embeds the query and returns the similar past cases found within the configured candidate/distance defaults', async () => {
        const pastCase = mockSimilarPastCase();
        ticketInvestigationRepository.findSimilarCases.mockResolvedValue([pastCase]);

        const result = await sut.recall(QUERY, EXCLUDE_TICKET_ID);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(QUERY);
        expect(ticketInvestigationRepository.findSimilarCases).toHaveBeenCalledWith(
          EMBEDDING,
          EXCLUDE_TICKET_ID,
          EPISODIC_MEMORY_DEFAULTS.CANDIDATE_K,
          EPISODIC_MEMORY_DEFAULTS.MAX_DISTANCE,
        );
        expect(result).toEqual([pastCase]);
      });
    });

    describe('When no similar past cases are found', () => {
      test('Then it returns an empty array', async () => {
        ticketInvestigationRepository.findSimilarCases.mockResolvedValue([]);

        const result = await sut.recall(QUERY, EXCLUDE_TICKET_ID);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Given embedEpisode', () => {
    describe('When the investigation status is completed', () => {
      test('Then it embeds the ticket subject, description, diagnosis, and resolution', async () => {
        const result = mockTicketInvestigationResult({
          status: 'completed',
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          proposedAction: 'refund',
        });

        const embedding = await sut.embedEpisode(TICKET, result);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(
          `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            `Diagnosis: ${result.diagnosis}\nResolution: ${result.proposedAction}`,
        );
        expect(embedding).toEqual(EMBEDDING);
      });
    });

    describe('When the investigation has no proposed action', () => {
      test('Then it embeds the episode text with the resolution placeholder', async () => {
        const result = mockTicketInvestigationResult({
          status: 'completed',
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          proposedAction: null,
        });

        await sut.embedEpisode(TICKET, result);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(
          `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            `Diagnosis: ${result.diagnosis}\nResolution: (none)`,
        );
      });
    });

    describe('When the ticket has no description', () => {
      test('Then it embeds the episode text with the description placeholder', async () => {
        const ticketWithoutDescription = mockTicketSelect({ subject: TICKET.subject, description: null });
        const result = mockTicketInvestigationResult({ status: 'completed', diagnosis: 'x', proposedAction: 'refund' });

        await sut.embedEpisode(ticketWithoutDescription, result);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(
          `Subject: ${TICKET.subject}\nDescription: (none provided)\nDiagnosis: x\nResolution: refund`,
        );
      });
    });

    describe('When the investigation status is not completed', () => {
      test('Then it returns null without embedding anything', async () => {
        const result = mockTicketInvestigationResult({ status: 'needs_review' });

        const embedding = await sut.embedEpisode(TICKET, result);

        expect(aiClient.generateEmbedding).not.toHaveBeenCalled();
        expect(embedding).toBeNull();
      });
    });
  });
});
