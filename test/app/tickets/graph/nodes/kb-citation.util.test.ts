import { KbCitationUtil } from '../../../../../src/app/tickets/graph/nodes/kb-citation.util';
import { mockKbChunkSelect } from '../../../../__mocks__';

describe('KbCitationUtil Unit Test', () => {
  describe('Given buildLabeledFindings', () => {
    describe('When called with multiple chunks', () => {
      test('Then it labels each chunk in order and maps each label back to its chunk id', () => {
        const chunkA = mockKbChunkSelect({ content: 'Webhook retries must be idempotent.' });
        const chunkB = mockKbChunkSelect({ content: 'Refunds require a manager approval note.' });

        const { text, labelToChunkId } = KbCitationUtil.buildLabeledFindings([chunkA, chunkB]);

        expect(text).toBe(`[[KB1]] ${chunkA.content}\n\n---\n\n[[KB2]] ${chunkB.content}`);
        expect(labelToChunkId).toEqual(
          new Map([
            ['KB1', chunkA.id],
            ['KB2', chunkB.id],
          ]),
        );
      });
    });
  });

  describe('Given extractCitedChunkIds', () => {
    describe('When the diagnosis text cites known labels', () => {
      test('Then it returns the deduplicated chunk ids for the cited labels, ignoring uncited labels', () => {
        const chunkA = mockKbChunkSelect();
        const chunkB = mockKbChunkSelect();
        const labelToChunkId = new Map([
          ['KB1', chunkA.id],
          ['KB2', chunkB.id],
        ]);

        const result = KbCitationUtil.extractCitedChunkIds(
          'The root cause is X [[KB1]]. This also explains Y [[KB1]].',
          labelToChunkId,
        );

        expect(result).toEqual([chunkA.id]);
      });
    });

    describe('When the diagnosis text cites a label that does not map to a real chunk', () => {
      test('Then it silently ignores the unknown label', () => {
        const chunkA = mockKbChunkSelect();
        const labelToChunkId = new Map([['KB1', chunkA.id]]);

        const result = KbCitationUtil.extractCitedChunkIds('Root cause is X [[KB1]] and also [[KB9]].', labelToChunkId);

        expect(result).toEqual([chunkA.id]);
      });
    });

    describe('When the diagnosis text cites no labels', () => {
      test('Then it returns an empty array', () => {
        const labelToChunkId = new Map([['KB1', mockKbChunkSelect().id]]);

        const result = KbCitationUtil.extractCitedChunkIds('No supporting excerpt found.', labelToChunkId);

        expect(result).toEqual([]);
      });
    });
  });
});
