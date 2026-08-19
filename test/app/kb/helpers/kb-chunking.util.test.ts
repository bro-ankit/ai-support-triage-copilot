import { KbChunkingUtil } from '../../../../src/app/kb/helpers/kb-chunking.util';

describe('KbChunkingUtil Unit Test', () => {
  describe('Given chunkArticle', () => {
    describe.each([
      {
        scenario: 'rawContent is an empty string',
        rawContent: '',
        options: {},
        expected: [],
      },
      {
        scenario: 'rawContent is only whitespace',
        rawContent: '   \n\n   ',
        options: {},
        expected: [],
      },
      {
        scenario: 'rawContent fits within a single target chunk size',
        rawContent: 'Hello world',
        options: { targetChunkSize: 1000, overlapSize: 150 },
        expected: [{ chunkIndex: 0, content: 'Hello world' }],
      },
      {
        scenario: 'two paragraphs together fit within the target chunk size',
        rawContent: 'Para one.\n\nPara two.',
        options: { targetChunkSize: 100, overlapSize: 20 },
        expected: [{ chunkIndex: 0, content: 'Para one.\n\nPara two.' }],
      },
      {
        scenario: 'two paragraphs together exceed the target chunk size',
        rawContent: 'AAAAAAAAAA\n\nBBBBBBBBBB',
        options: { targetChunkSize: 10, overlapSize: 3 },
        expected: [
          { chunkIndex: 0, content: 'AAAAAAAAAA' },
          { chunkIndex: 1, content: 'BBBBBBBBBB' },
        ],
      },
      {
        scenario: 'content has no usable separator and exceeds the target chunk size',
        rawContent: 'X'.repeat(25),
        options: { targetChunkSize: 10, overlapSize: 2, separators: [''] },
        expected: [
          { chunkIndex: 0, content: 'X'.repeat(10) },
          { chunkIndex: 1, content: 'X'.repeat(10) },
          { chunkIndex: 2, content: 'X'.repeat(9) },
        ],
      },
      {
        scenario: 'a small piece precedes an oversized piece at the last available separator level',
        rawContent: `short\n\n${'Y'.repeat(20)}`,
        options: { targetChunkSize: 10, overlapSize: 2, separators: ['\n\n'] },
        expected: [
          { chunkIndex: 0, content: 'short' },
          { chunkIndex: 1, content: 'Y'.repeat(10) },
        ],
      },
      {
        scenario: 'content splits into more pieces than fit in one chunk',
        rawContent: 'aa bb cc dd ee ff gg',
        options: { targetChunkSize: 8, overlapSize: 5, separators: [' '] },
        expected: [
          { chunkIndex: 0, content: 'aa bb cc' },
          { chunkIndex: 1, content: 'bb cc dd' },
          { chunkIndex: 2, content: 'cc dd ee' },
          { chunkIndex: 3, content: 'dd ee ff' },
          { chunkIndex: 4, content: 'ee ff gg' },
        ],
      },
    ])('When $scenario', ({ rawContent, options, expected }) => {
      test('Then it returns the expected chunks', () => {
        expect(KbChunkingUtil.chunkArticle(rawContent, options)).toEqual(expected);
      });
    });
  });

  describe('Given estimateTokenCount', () => {
    describe.each([
      { scenario: 'text length divides evenly by 4', text: '12345678', expected: 2 },
      { scenario: 'text length does not divide evenly by 4', text: '123456789', expected: 3 },
      { scenario: 'text is an empty string', text: '', expected: 0 },
    ])('When $scenario', ({ text, expected }) => {
      test(`Then it returns ${expected}`, () => {
        expect(KbChunkingUtil.estimateTokenCount(text)).toBe(expected);
      });
    });
  });
});
