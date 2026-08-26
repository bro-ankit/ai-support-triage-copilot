import { ClassifyTicketPromptUtil } from '../../../../src/app/tickets/classification/classify-ticket-prompt.util';
import { mockTicketSelect } from '../../../__mocks__';

describe('ClassifyTicketPromptUtil Unit Test', () => {
  describe('Given buildUserContent', () => {
    describe('When the ticket has a description and attachment text is provided', () => {
      test('Then it wraps subject, description, and attachment text in untrusted content tags', () => {
        const ticket = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });

        const result = ClassifyTicketPromptUtil.buildUserContent(ticket, 'Order #4821');

        expect(result).toBe(
          '<untrusted_ticket_content>\n' +
            'Subject: Charged twice\n' +
            'Description: Please refund the duplicate charge.\n' +
            'Attachment text: Order #4821\n' +
            '</untrusted_ticket_content>',
        );
      });
    });

    describe('When the ticket has no description and no attachment text', () => {
      test('Then it fills in the none-provided placeholders', () => {
        const ticket = mockTicketSelect({ subject: 'Login issue', description: null });

        const result = ClassifyTicketPromptUtil.buildUserContent(ticket, '');

        expect(result).toBe(
          '<untrusted_ticket_content>\n' +
            'Subject: Login issue\n' +
            'Description: (none provided)\n' +
            'Attachment text: (none)\n' +
            '</untrusted_ticket_content>',
        );
      });
    });
  });
});
