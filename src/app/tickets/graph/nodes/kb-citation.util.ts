import type { UUID } from 'node:crypto';

import type { KbChunkSelect } from '../../../../schema/kb-chunks.schema';

export class KbCitationUtil {
  private static readonly CITATION_LABEL_PATTERN = /\[\[KB(\d+)\]\]/g;

  static buildLabeledFindings(chunks: KbChunkSelect[]): { text: string; labelToChunkId: Map<string, UUID> } {
    const labelToChunkId = new Map<string, UUID>();
    const text = chunks
      .map((chunk, index) => {
        const label = `KB${index + 1}`;
        labelToChunkId.set(label, chunk.id);
        return `[[${label}]] ${chunk.content}`;
      })
      .join('\n\n---\n\n');

    return { text, labelToChunkId };
  }

  static extractCitedChunkIds(diagnosisText: string, labelToChunkId: Map<string, UUID>): UUID[] {
    const citedChunkIds = new Set<UUID>();
    for (const match of diagnosisText.matchAll(this.CITATION_LABEL_PATTERN)) {
      const chunkId = labelToChunkId.get(`KB${match[1]}`);
      if (chunkId) citedChunkIds.add(chunkId);
    }
    return [...citedChunkIds];
  }
}
