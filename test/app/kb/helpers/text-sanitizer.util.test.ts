import { TextSanitizerUtil } from '../../../../src/app/kb/helpers/text-sanitizer.util';

describe('TextSanitizerUtil Unit Test', () => {
  describe('Given stripHiddenCharacters', () => {
    describe('When the text contains zero-width and bidi-control characters', () => {
      test('Then it removes them while leaving the visible text intact', () => {
        const zeroWidthSpace = String.fromCharCode(0x200b);
        const rightToLeftOverride = String.fromCharCode(0x202e);
        const byteOrderMark = String.fromCharCode(0xfeff);
        const input = `hello${zeroWidthSpace}world${rightToLeftOverride}test${byteOrderMark} end`;

        const result = TextSanitizerUtil.stripHiddenCharacters(input);

        expect(result).toBe('helloworldtest end');
      });
    });

    describe('When the text contains C0 control characters', () => {
      test('Then it removes them but keeps tab, newline, and carriage return', () => {
        const nullChar = String.fromCharCode(0x00);
        const verticalTab = String.fromCharCode(0x0b);
        const input = `line1${nullChar}${verticalTab}\nline2\ttabbed\rline3`;

        const result = TextSanitizerUtil.stripHiddenCharacters(input);

        expect(result).toBe('line1\nline2\ttabbed\rline3');
      });
    });

    describe('When the text has no hidden characters', () => {
      test('Then it returns the text unchanged', () => {
        const input = 'Webhook retries must be idempotent using an idempotency key per event.';

        const result = TextSanitizerUtil.stripHiddenCharacters(input);

        expect(result).toBe(input);
      });
    });
  });
});
