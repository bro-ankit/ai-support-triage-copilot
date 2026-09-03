import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { PersistNode } from '../../../../../src/app/tickets/graph/nodes/persist.node';
import { EpisodicMemoryService } from '../../../../../src/app/tickets/memory/episodic-memory.service';
import { TicketInvestigationRepository } from '../../../../../src/app/tickets/repositories/ticket-investigation.repository';
import {
  mockTicketInvestigationGraphState,
  mockTicketInvestigationResult,
  mockTicketInvestigationSelect,
  mockTicketSelect,
} from '../../../../__mocks__';
import { AssertUtils } from '../../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const EARLY_RESULT = mockTicketInvestigationResult({ status: 'completed' });
const EMBEDDING = [0.1, 0.2, 0.3];
const STATE = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, ticket: TICKET, earlyResult: EARLY_RESULT });

describe('PersistNode Unit Test', () => {
  let sut: PersistNode;
  let episodicMemoryService: jest.Mocked<EpisodicMemoryService>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(PersistNode).compile();

    sut = unit;
    episodicMemoryService = unitRef.get(EpisodicMemoryService);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    episodicMemoryService.embedEpisode.mockResolvedValue(EMBEDDING);
  });

  describe('Given run', () => {
    describe('When called with an early result', () => {
      test('Then it embeds the episode, persists the investigation with that embedding, and returns it', async () => {
        const investigation = mockTicketInvestigationSelect({ ticketId: TICKET_ID });
        ticketInvestigationRepository.insert.mockResolvedValue(investigation);

        const result = await sut.run(STATE);

        expect(episodicMemoryService.embedEpisode).toHaveBeenCalledWith(TICKET, EARLY_RESULT);
        expect(ticketInvestigationRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          ticketId: TICKET_ID,
          episodeEmbedding: EMBEDDING,
          ...EARLY_RESULT,
        });
        expect(result).toEqual({ investigation });
      });
    });

    describe('When called without an early result', () => {
      test('Then it throws without embedding or persisting anything', async () => {
        await AssertUtils.assertError(
          () => sut.run(mockTicketInvestigationGraphState({ ...STATE, earlyResult: undefined })),
          `Ticket investigation graph reached persist for ${TICKET_ID} without a result`,
        );
        expect(episodicMemoryService.embedEpisode).not.toHaveBeenCalled();
        expect(ticketInvestigationRepository.insert).not.toHaveBeenCalled();
      });
    });
  });
});
