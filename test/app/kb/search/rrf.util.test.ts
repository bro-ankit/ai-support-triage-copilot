import { RrfUtil } from '../../../../src/app/kb/search/rrf.util';

const RRF_K = 60;
const rrfScore = (rank: number) => 1 / (RRF_K + rank + 1);

describe('RrfUtil Unit Test', () => {
  describe('Given fuse', () => {
    describe.each([
      {
        scenario: 'called with two disjoint candidate lists',
        vectorIds: ['a', 'b'],
        lexicalIds: ['c'],
        expected: [
          { id: 'a', score: rrfScore(0) },
          { id: 'c', score: rrfScore(0) },
          { id: 'b', score: rrfScore(1) },
        ],
      },
      {
        scenario: 'a candidate appears in both lists',
        vectorIds: ['vector-only', 'shared'],
        lexicalIds: ['shared'],
        expected: [
          { id: 'shared', score: rrfScore(1) + rrfScore(0) },
          { id: 'vector-only', score: rrfScore(0) },
        ],
      },
      {
        scenario: 'one retriever returns no results',
        vectorIds: [],
        lexicalIds: ['x', 'y'],
        expected: [
          { id: 'x', score: rrfScore(0) },
          { id: 'y', score: rrfScore(1) },
        ],
      },
      {
        scenario: 'both retrievers return no results',
        vectorIds: [],
        lexicalIds: [],
        expected: [],
      },
      {
        scenario: 'more than two results are returned',
        vectorIds: ['first', 'second', 'third'],
        lexicalIds: [],
        expected: [
          { id: 'first', score: rrfScore(0) },
          { id: 'second', score: rrfScore(1) },
          { id: 'third', score: rrfScore(2) },
        ],
      },
    ])('When $scenario', ({ vectorIds, lexicalIds, expected }) => {
      test('Then it returns ids sorted by descending fused RRF score', () => {
        expect(RrfUtil.fuse(vectorIds, lexicalIds)).toEqual(expected);
      });
    });
  });
});
