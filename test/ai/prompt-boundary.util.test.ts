import { PromptBoundaryUtil } from '../../src/ai/prompt-boundary.util';

describe('PromptBoundaryUtil Unit Test', () => {
  describe('Given wrap', () => {
    describe('When called with a tag and content', () => {
      test('Then it wraps the content in matching open/close tags on their own lines', () => {
        const result = PromptBoundaryUtil.wrap('untrusted_ticket_content', 'Subject: test\nDescription: test');

        expect(result).toBe('<untrusted_ticket_content>\nSubject: test\nDescription: test\n</untrusted_ticket_content>');
      });
    });
  });
});
