ALTER TABLE "ticket_investigations" ADD COLUMN "cited_chunk_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "ticket_investigations" ALTER COLUMN "cited_chunk_ids" DROP DEFAULT;