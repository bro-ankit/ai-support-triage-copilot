import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { RequestTicketAttachmentUploadCommand } from '../../../../src/app/tickets/commands/request-ticket-attachment-upload.command';
import { RequestTicketAttachmentUploadCommandHandler } from '../../../../src/app/tickets/commands/request-ticket-attachment-upload.command-handler';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../../../../src/app/tickets/commands/request-ticket-attachment-upload.constants';
import { TicketAttachmentRepository } from '../../../../src/app/tickets/repositories/ticket-attachment.repository';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import type { IStorageClient } from '../../../../src/storage/storage.interface';
import { STORAGE_CLIENT } from '../../../../src/storage/storage.constants';
import { mockRequestAttachmentUploadRequestDto, mockTicketAttachmentSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const REQUEST = mockRequestAttachmentUploadRequestDto();
const PRESIGNED = { url: 'https://s3.example.com/support-triage-attachments', fields: { key: 'field-value' } };
const INSERTED_ATTACHMENT = mockTicketAttachmentSelect({ ticketId: TICKET_ID });
const OBJECT_KEY_PATTERN = new RegExp(`^tickets/${TICKET_ID}/.+-${REQUEST.filename}$`);

describe('RequestTicketAttachmentUploadCommandHandler Unit Test', () => {
  let sut: RequestTicketAttachmentUploadCommandHandler;
  let storageClient: jest.Mocked<IStorageClient>;
  let ticketRepository: jest.Mocked<TicketRepository>;
  let ticketAttachmentRepository: jest.Mocked<TicketAttachmentRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RequestTicketAttachmentUploadCommandHandler).compile();

    sut = unit;
    storageClient = unitRef.get(STORAGE_CLIENT);
    ticketRepository = unitRef.get(TicketRepository);
    ticketAttachmentRepository = unitRef.get(TicketAttachmentRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given execute', () => {
    describe('When called for an existing ticket', () => {
      test('Then it presigns using the size limit for the requested kind, inserts the attachment, and returns the response', async () => {
        ticketRepository.findById.mockResolvedValue(TICKET);
        storageClient.getPresignedUploadUrl.mockResolvedValue(PRESIGNED);
        ticketAttachmentRepository.insert.mockResolvedValue(INSERTED_ATTACHMENT);

        const result = await sut.execute(new RequestTicketAttachmentUploadCommand(TICKET_ID, REQUEST));

        expect(ticketRepository.findById).toHaveBeenCalledWith(TICKET_ID);
        expect(storageClient.getPresignedUploadUrl.mock.calls).toEqual([
          [expect.stringMatching(OBJECT_KEY_PATTERN), REQUEST.mimeType, MAX_ATTACHMENT_SIZE_BYTES[REQUEST.kind]],
        ]);

        expect(ticketAttachmentRepository.insert.mock.calls).toEqual([
          [
            {
              id: expect.any(String),
              ticketId: TICKET_ID,
              kind: REQUEST.kind,
              objectKey: expect.stringMatching(OBJECT_KEY_PATTERN),
              mimeType: REQUEST.mimeType,
              processingStatus: 'pending_upload',
            },
          ],
        ]);

        expect(result).toEqual({
          attachmentId: INSERTED_ATTACHMENT.id,
          uploadUrl: PRESIGNED.url,
          uploadFields: PRESIGNED.fields,
          objectKey: expect.stringMatching(OBJECT_KEY_PATTERN),
        });
      });
    });

    describe('When the ticket does not exist', () => {
      test('Then it throws NotFoundException without presigning or inserting an attachment', async () => {
        ticketRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          () => sut.execute(new RequestTicketAttachmentUploadCommand(TICKET_ID, REQUEST)),
          `Ticket ${TICKET_ID} not found`,
          404,
        );
        expect(storageClient.getPresignedUploadUrl).not.toHaveBeenCalled();
        expect(ticketAttachmentRepository.insert).not.toHaveBeenCalled();
      });
    });

    describe('When presigning the upload fails', () => {
      test('Then it propagates the error without inserting an attachment row', async () => {
        ticketRepository.findById.mockResolvedValue(TICKET);
        storageClient.getPresignedUploadUrl.mockRejectedValue(new Error('storage unavailable'));

        await AssertUtils.assertError(
          () => sut.execute(new RequestTicketAttachmentUploadCommand(TICKET_ID, REQUEST)),
          'storage unavailable',
        );
        expect(ticketAttachmentRepository.insert).not.toHaveBeenCalled();
      });
    });
  });
});
