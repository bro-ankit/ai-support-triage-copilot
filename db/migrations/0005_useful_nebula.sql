ALTER TABLE "ticket_investigations" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_investigations" ADD COLUMN "episode_embedding" vector(768);--> statement-breakpoint
UPDATE "ticket_investigations" ti SET "tenant_id" = t."tenant_id" FROM "tickets" t WHERE t."id" = ti."ticket_id" AND ti."tenant_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ticket_investigations" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_investigations_episode_embedding_hnsw_idx"
    ON "ticket_investigations"
    USING hnsw (episode_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
