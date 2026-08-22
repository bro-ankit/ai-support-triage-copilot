import { RedisTagEscapeUtil } from '../../../src/cache/clients/redis-tag-escape.util';

describe('RedisTagEscapeUtil', () => {
  describe('Given a UUID containing hyphens', () => {
    describe('When escape is called', () => {
      test('Then every hyphen is backslash-escaped', () => {
        const result = RedisTagEscapeUtil.escape('11111111-1111-1111-1111-111111111111');

        expect(result).toBe('11111111\\-1111\\-1111\\-1111\\-111111111111');
      });
    });
  });

  describe('Given a value with RediSearch TAG special characters', () => {
    describe('When escape is called', () => {
      test('Then every special character is individually backslash-escaped', () => {
        const result = RedisTagEscapeUtil.escape('a,b.c<d>e{f}g[h]i"j\'k:l;m!n@o#p$q%r^s&t*u(v)w~x y');

        expect(result).toBe(
          'a\\,b\\.c\\<d\\>e\\{f\\}g\\[h\\]i\\"j\\\'k\\:l\\;m\\!n\\@o\\#p\\$q\\%r\\^s\\&t\\*u\\(v\\)w\\~x\\ y',
        );
      });
    });
  });

  describe('Given a value with no special characters', () => {
    describe('When escape is called', () => {
      test('Then it is returned unchanged', () => {
        const result = RedisTagEscapeUtil.escape('plaintenant');

        expect(result).toBe('plaintenant');
      });
    });
  });

  describe('Given an empty string', () => {
    describe('When escape is called', () => {
      test('Then it returns an empty string', () => {
        const result = RedisTagEscapeUtil.escape('');

        expect(result).toBe('');
      });
    });
  });
});
