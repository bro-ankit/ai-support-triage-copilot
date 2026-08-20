import { randomUUID, type UUID } from 'node:crypto';

import { TicketAttachmentRepository } from '../../../../src/app/tickets/repositories/ticket-attachment.repository';
import { ticketAttachmentsTable } from '../../../../src/schema/ticket-attachments.schema';
import type { TicketAttachmentInsert } from '../../../../src/schema/ticket-attachments.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockTicketAttachmentInsert, mockTicketInsert } from '../../../__mocks__';

describe('TicketAttachmentRepository IT', () => {
  let sut: TicketAttachmentRepository;
  const env = new DrizzleTestEnvironment();
  let ticketId: UUID;

  beforeAll(async () => {
    await env.start([TicketAttachmentRepository]);
    sut = env.module.get(TicketAttachmentRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(ticketAttachmentsTable);
  });

  beforeEach(async () => {
    const [ticket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
    ticketId = ticket.id;
  });

  const seed = (overrides: Partial<TicketAttachmentInsert> = {}) =>
    sut.insert(mockTicketAttachmentInsert({ ticketId, ...overrides }));

  describe('Given insert', () => {
    describe('When called with a valid attachment', () => {
      test('Then it persists the attachment and returns it with the given id and defaulted processing status', async () => {
        const data = mockTicketAttachmentInsert({ ticketId, kind: 'voice_note', mimeType: 'audio/wav' });

        const result = await sut.insert(data);

        expect(result).toEqual({
          id: data.id,
          ticketId,
          kind: 'voice_note',
          objectKey: data.objectKey,
          mimeType: 'audio/wav',
          extractedText: null,
          processingStatus: 'pending_upload',
          processingError: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });
  });

  describe('Given findById', () => {
    describe('When the attachment exists', () => {
      test('Then it returns that attachment', async () => {
        const inserted = await seed();

        const result = await sut.findById(inserted.id);

        expect(result).toEqual(inserted);
      });
    });

    describe('When the attachment does not exist', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findById(randomUUID());

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given findByTicketId', () => {
    describe('When the ticket has attachments', () => {
      test('Then it returns only that ticket\'s attachments', async () => {
        const own = await seed({ kind: 'screenshot' });
        const [otherTicket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
        await sut.insert(mockTicketAttachmentInsert({ ticketId: otherTicket.id, kind: 'voice_note' }));

        const result = await sut.findByTicketId(ticketId);

        expect(result).toEqual([own]);
      });
    });

    describe('When the ticket has no attachments', () => {
      test('Then it returns an empty array', async () => {
        const result = await sut.findByTicketId(ticketId);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Given updateProcessingResult', () => {
    describe('When marking an attachment completed with extracted text', () => {
      test('Then it persists the new status and extracted text, leaving processingError untouched', async () => {
        const inserted = await seed();

        const result = await sut.updateProcessingResult(inserted.id, {
          processingStatus: 'completed',
          extractedText: 'Error 500: payment failed',
        });

        expect(result).toEqual({
          ...inserted,
          processingStatus: 'completed',
          extractedText: 'Error 500: payment failed',
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('When marking an attachment failed with a processing error', () => {
      test('Then it persists the failed status and processing error', async () => {
        const inserted = await seed();

        const result = await sut.updateProcessingResult(inserted.id, {
          processingStatus: 'failed',
          processingError: 'Gemini timed out',
        });

        expect(result).toEqual({
          ...inserted,
          processingStatus: 'failed',
          processingError: 'Gemini timed out',
          updatedAt: expect.any(Date),
        });
      });
    });
  });
});
