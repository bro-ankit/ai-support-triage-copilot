import { KB_CHUNKING_DEFAULTS } from './kb-chunking.constants';
import type { KbChunk } from './kb-chunking.types';

export class KbChunkingUtil {
  private static readonly DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

  static chunkArticle(
    rawContent: string,
    options: { targetChunkSize?: number; overlapSize?: number; separators?: string[] } = {},
  ): KbChunk[] {
    const targetChunkSize = options.targetChunkSize ?? KB_CHUNKING_DEFAULTS.TARGET_CHUNK_SIZE;
    const overlapSize = options.overlapSize ?? KB_CHUNKING_DEFAULTS.OVERLAP_SIZE;
    const separators = options.separators ?? this.DEFAULT_SEPARATORS;

    if (!rawContent || rawContent.trim().length === 0) return [];

    const rawChunks = this.recursiveSplit(rawContent, separators, targetChunkSize, overlapSize);

    return rawChunks
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .map((content, chunkIndex) => ({ chunkIndex, content }));
  }

  /**
   * TODO: For exact counts, call GeminiClient's underlying model.countTokens() instead
   */
  static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private static recursiveSplit(
    text: string,
    separators: string[],
    targetChunkSize: number,
    overlapSize: number,
  ): string[] {
    const finalChunks: string[] = [];

    let separator = separators[separators.length - 1];
    let nextSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i];
      if (s === '' || text.includes(s)) {
        separator = s;
        nextSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator ? text.split(separator) : Array.from(text);
    const goodSplits: string[] = [];

    for (const piece of splits) {
      if (piece.length < targetChunkSize) {
        goodSplits.push(piece);
      } else {
        if (goodSplits.length > 0) {
          const merged = this.mergeSplits(goodSplits, separator, targetChunkSize, overlapSize);
          finalChunks.push(...merged);
          goodSplits.length = 0;
        }
        if (nextSeparators.length === 0) {
          finalChunks.push(piece.slice(0, targetChunkSize));
        } else {
          const recurseResults = this.recursiveSplit(piece, nextSeparators, targetChunkSize, overlapSize);
          finalChunks.push(...recurseResults);
        }
      }
    }

    if (goodSplits.length > 0) {
      const merged = this.mergeSplits(goodSplits, separator, targetChunkSize, overlapSize);
      finalChunks.push(...merged);
    }

    return finalChunks;
  }

  private static mergeSplits(
    splits: string[],
    separator: string,
    targetChunkSize: number,
    overlapSize: number,
  ): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const split of splits) {
      const len = split.length;
      const sepLen = currentChunk.length > 0 ? separator.length : 0;

      if (currentLength + len + sepLen > targetChunkSize) {
        if (currentChunk.length > 0) {
          const doc = currentChunk.join(separator);
          chunks.push(doc);

          while (
            currentLength > overlapSize ||
            (currentLength + len + sepLen > targetChunkSize && currentLength > 0)
          ) {
            const popped = currentChunk.shift();
            if (!popped) break;
            currentLength -= popped.length + (currentChunk.length > 0 ? separator.length : 0);
          }
        }
      }

      currentChunk.push(split);
      currentLength += len + (currentChunk.length > 1 ? separator.length : 0);
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));
    }

    return chunks;
  }
}