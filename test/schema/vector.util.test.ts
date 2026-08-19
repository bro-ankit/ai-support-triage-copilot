import { pgTable } from 'drizzle-orm/pg-core';

import { VectorTypeUtil } from '../../src/schema/vector.util';

describe('VectorTypeUtil Unit Test', () => {
  describe('Given parseString, When called', () => {
    describe('And input is a standard pgvector string', () => {
      test('Then it returns the correct number array', () => {
        expect(VectorTypeUtil.parseString('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3]);
      });
    });

    describe('And input is an empty vector string', () => {
      test('Then it returns an empty array', () => {
        expect(VectorTypeUtil.parseString('[]')).toEqual([]);
      });
    });

    describe('And input is a single-element vector', () => {
      test('Then it returns a one-element array', () => {
        expect(VectorTypeUtil.parseString('[0.5]')).toEqual([0.5]);
      });
    });

    describe('And input contains negative values', () => {
      test('Then it preserves the sign on each element', () => {
        expect(VectorTypeUtil.parseString('[-0.1,-0.9,0.5]')).toEqual([-0.1, -0.9, 0.5]);
      });
    });

    describe('And input contains scientific notation emitted by pgvector for near-zero values', () => {
      const RAW = '[1.23e-7,4.56e-10]';

      test('Then it parses each element without loss of precision', () => {
        const result = VectorTypeUtil.parseString(RAW);

        expect(result[0]).toBeCloseTo(1.23e-7);
        expect(result[1]).toBeCloseTo(4.56e-10);
      });
    });

    describe('And input is a full 768-dimension vector', () => {
      const DIMS = 768;
      const RAW = `[${new Array(DIMS).fill('0.1').join(',')}]`;

      test('Then the result array length matches the dimension count', () => {
        expect(VectorTypeUtil.parseString(RAW)).toHaveLength(DIMS);
      });
    });

    describe('And input contains high-precision floats', () => {
      const RAW = '[0.123456789,0.987654321]';

      test('Then precision is maintained to 8 decimal places', () => {
        const result = VectorTypeUtil.parseString(RAW);

        expect(result[0]).toBeCloseTo(0.123456789, 8);
        expect(result[1]).toBeCloseTo(0.987654321, 8);
      });
    });
  });

  describe('Given toDriverString, When called', () => {
    describe('And input is a standard float array', () => {
      test('Then it returns the pgvector bracket-format string', () => {
        expect(VectorTypeUtil.toDriverString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
      });
    });

    describe('And input is an empty array', () => {
      test('Then it returns empty brackets', () => {
        expect(VectorTypeUtil.toDriverString([])).toBe('[]');
      });
    });

    describe('And input is a single-element array', () => {
      test('Then it wraps the single value in brackets', () => {
        expect(VectorTypeUtil.toDriverString([0.5])).toBe('[0.5]');
      });
    });

    describe('And output is passed back through parseString', () => {
      const ORIGINAL = [0.1, 0.2, -0.3, 0.999];

      test('Then the round-trip produces the original values', () => {
        const roundTripped = VectorTypeUtil.parseString(VectorTypeUtil.toDriverString(ORIGINAL));
        expect(roundTripped).toEqual(ORIGINAL);
      });
    });
  });

  describe('Given buildConfig, When called with a dimension count', () => {
    describe('And dimensions is 768', () => {
      const CONFIG = VectorTypeUtil.buildConfig(768);

      test('Then dataType() returns vector(768)', () => {
        expect(CONFIG.dataType()).toBe('vector(768)');
      });

      test('Then toDriver serialises a number array to pgvector format', () => {
        expect(CONFIG.toDriver([0.1, 0.2])).toBe('[0.1,0.2]');
      });

      test('Then fromDriver parses a pgvector string to a number array', () => {
        expect(CONFIG.fromDriver('[0.1,0.2]')).toEqual([0.1, 0.2]);
      });
    });

    describe('And dimensions is 1536', () => {
      test('Then dataType() returns vector(1536)', () => {
        expect(VectorTypeUtil.buildConfig(1536).dataType()).toBe('vector(1536)');
      });
    });

    describe('And two configs are created with different dimensions', () => {
      const CONFIG_768 = VectorTypeUtil.buildConfig(768);
      const CONFIG_1536 = VectorTypeUtil.buildConfig(1536);

      test('Then each config independently captures its own dimension in the closure', () => {
        expect(CONFIG_768.dataType()).toBe('vector(768)');
        expect(CONFIG_1536.dataType()).toBe('vector(1536)');
      });
    });
  });

  describe('Given createVectorType, When called with a dimension count', () => {
    describe('And a table column is built from the returned factory', () => {
      test('Then the column reports the vector(dimensions) SQL type', () => {
        const table = pgTable('t', { embedding: VectorTypeUtil.createVectorType(1536)('embedding') });
        expect(table.embedding.getSQLType()).toBe('vector(1536)');
      });
    });
  });
});
