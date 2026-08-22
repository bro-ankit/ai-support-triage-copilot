import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { CompleteTicketAttachmentUploadCommand } from '../../../../src/app/tickets/commands/complete-ticket-attachment-upload.command';
import { CompleteTicketAttachmentUploadCommandHandler } from '../../../../src/app/tickets/commands/complete-ticket-attachment-upload.command-handler';
import { TicketAttachmentRepository } from '../../../../src/app/tickets/repositories/ticket-attachment.repository';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import type { IStorageClient } from '../../../../src/storage/storage.interface';
import { STORAGE_CLIENT } from '../../../../src/storage/storage.constants';
import { mockTicketAttachmentSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const ATTACHMENT_ID = randomUUID();
const BUFFER = Buffer.from('fake-file-bytes');
const OCR_TEXT = 'Error 500: payment failed';
const TRANSCRIPT_TEXT = 'The checkout page keeps crashing on my phone.';

describe('CompleteTicketAttachmentUploadCommandHandler Unit Test', () => {
  let sut: CompleteTicketAttachmentUploadCommandHandler;
  let aiClient: jest.Mocked<IAiClient>;
  let storageClient: jest.Mocked<IStorageClient>;
  let ticketAttachmentRepository: jest.Mocked<TicketAttachmentRepository>;
  let ticketRepository: jest.Mocked<TicketRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(CompleteTicketAttachmentUploadCommandHandler).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    storageClient = unitRef.get(STORAGE_CLIENT);
    ticketAttachmentRepository = unitRef.get(TicketAttachmentRepository);
    ticketRepository = unitRef.get(TicketRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ticketRepository.findById.mockResolvedValue(mockTicketSelect({ id: TICKET_ID }));
  });

  describe('Given execute', () => {
    describe('When the attachment is a screenshot belonging to the ticket', () => {
      test('Then it fetches the object, runs OCR, and marks the attachment completed with the extracted text', async () => {
        const attachment = mockTicketAttachmentSelect({ id: ATTACHMENT_ID, ticketId: TICKET_ID, kind: 'screenshot' });
        const updated = { ...attachment, processingStatus: 'completed' as const, extractedText: OCR_TEXT };
        ticketAttachmentRepository.findById.mockResolvedValue(attachment);
        storageClient.getObject.mockResolvedValue(BUFFER);
        aiClient.extractTextFromImage.mockResolvedValue(OCR_TEXT);
        ticketAttachmentRepository.updateProcessingResult.mockResolvedValue(updated);

        const result = await sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID));

        expect(storageClient.getObject).toHaveBeenCalledWith(attachment.objectKey);
        expect(aiClient.extractTextFromImage).toHaveBeenCalledWith(BUFFER, attachment.mimeType);
        expect(aiClient.transcribeAudio).not.toHaveBeenCalled();
        expect(ticketAttachmentRepository.updateProcessingResult).toHaveBeenCalledWith(ATTACHMENT_ID, {
          processingStatus: 'completed',
          extractedText: OCR_TEXT,
        });

        expect(result).toEqual({
          id: updated.id,
          kind: updated.kind,
          mimeType: updated.mimeType,
          extractedText: OCR_TEXT,
          processingStatus: 'completed',
          processingError: updated.processingError,
        });
      });
    });

    describe('When the attachment is a voice note belonging to the ticket', () => {
      test('Then it fetches the object, transcribes it, and marks the attachment completed with the transcript', async () => {
        const attachment = mockTicketAttachmentSelect({
          id: ATTACHMENT_ID,
          ticketId: TICKET_ID,
          kind: 'voice_note',
          mimeType: 'audio/wav',
        });
        const updated = { ...attachment, processingStatus: 'completed' as const, extractedText: TRANSCRIPT_TEXT };
        ticketAttachmentRepository.findById.mockResolvedValue(attachment);
        storageClient.getObject.mockResolvedValue(BUFFER);
        aiClient.transcribeAudio.mockResolvedValue(TRANSCRIPT_TEXT);
        ticketAttachmentRepository.updateProcessingResult.mockResolvedValue(updated);

        await sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID));

        expect(aiClient.transcribeAudio).toHaveBeenCalledWith(BUFFER, attachment.mimeType);
        expect(aiClient.extractTextFromImage).not.toHaveBeenCalled();
        expect(ticketAttachmentRepository.updateProcessingResult).toHaveBeenCalledWith(ATTACHMENT_ID, {
          processingStatus: 'completed',
          extractedText: TRANSCRIPT_TEXT,
        });
      });
    });

    describe('When extraction throws an Error', () => {
      test('Then it marks the attachment failed with the error message instead of throwing', async () => {
        const attachment = mockTicketAttachmentSelect({ id: ATTACHMENT_ID, ticketId: TICKET_ID, kind: 'screenshot' });
        const updated = { ...attachment, processingStatus: 'failed' as const, processingError: 'Gemini timed out' };
        ticketAttachmentRepository.findById.mockResolvedValue(attachment);
        storageClient.getObject.mockResolvedValue(BUFFER);
        aiClient.extractTextFromImage.mockRejectedValue(new Error('Gemini timed out'));
        ticketAttachmentRepository.updateProcessingResult.mockResolvedValue(updated);

        const result = await sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID));

        expect(ticketAttachmentRepository.updateProcessingResult).toHaveBeenCalledWith(ATTACHMENT_ID, {
          processingStatus: 'failed',
          processingError: 'Gemini timed out',
        });
        expect(result).toEqual({
          id: updated.id,
          kind: updated.kind,
          mimeType: updated.mimeType,
          extractedText: updated.extractedText,
          processingStatus: 'failed',
          processingError: 'Gemini timed out',
        });
      });
    });

    describe('When extraction throws a non-Error value', () => {
      test('Then it marks the attachment failed with a generic error message', async () => {
        const attachment = mockTicketAttachmentSelect({ id: ATTACHMENT_ID, ticketId: TICKET_ID, kind: 'screenshot' });
        const updated = { ...attachment, processingStatus: 'failed' as const, processingError: 'Unknown processing error' };
        ticketAttachmentRepository.findById.mockResolvedValue(attachment);
        storageClient.getObject.mockRejectedValue('storage exploded');
        ticketAttachmentRepository.updateProcessingResult.mockResolvedValue(updated);

        await sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID));

        expect(ticketAttachmentRepository.updateProcessingResult).toHaveBeenCalledWith(ATTACHMENT_ID, {
          processingStatus: 'failed',
          processingError: 'Unknown processing error',
        });
      });
    });

    describe('When the attachment does not exist', () => {
      test('Then it throws NotFoundException without touching storage or the AI client', async () => {
        ticketAttachmentRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          () => sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID)),
          `Ticket attachment ${ATTACHMENT_ID} not found`,
          404,
        );
        expect(storageClient.getObject).not.toHaveBeenCalled();
        expect(ticketAttachmentRepository.updateProcessingResult).not.toHaveBeenCalled();
      });
    });

    describe('When the attachment exists but belongs to a different ticket', () => {
      test('Then it throws NotFoundException without processing the attachment', async () => {
        const attachment = mockTicketAttachmentSelect({ id: ATTACHMENT_ID, ticketId: randomUUID() });
        ticketAttachmentRepository.findById.mockResolvedValue(attachment);

        await AssertUtils.assertError(
          () => sut.execute(new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID)),
          `Ticket attachment ${ATTACHMENT_ID} not found`,
          404,
        );
        expect(storageClient.getObject).not.toHaveBeenCalled();
        expect(ticketAttachmentRepository.updateProcessingResult).not.toHaveBeenCalled();
      });
    });
  });
});
