CREATE INDEX IF NOT EXISTS "kb_chunks_embedding_hnsw_idx"
    ON "kb_chunks"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_chunks_content_tsv_gin_idx"
    ON "kb_chunks"
    USING GIN ("content_tsv");
