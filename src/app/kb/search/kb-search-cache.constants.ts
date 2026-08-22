export const KB_SEARCH_CACHE_DEFAULTS = {
  KEY_PREFIX: 'kb-search-cache:',
  INDEX_NAME: 'kb-search-cache-idx',
  VECTOR_FIELD: 'embedding',
  TENANT_FIELD: 'tenantId',
  TTL_SECONDS: 60 * 60,
  // Cosine distance (1 - cosine similarity), much tighter than KB retrieval's own MAX_DISTANCE:
  // a cache hit claims "safe to reuse a whole prior answer", not just "relevant".
  MAX_DISTANCE: 0.03,
  HITS_KEY: 'kb-search-cache:stats:hits',
  MISSES_KEY: 'kb-search-cache:stats:misses',
} as const;
