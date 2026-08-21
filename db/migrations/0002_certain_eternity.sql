CREATE TABLE "ticket_classifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"confidence" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_investigations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"retrieved_chunk_ids" jsonb NOT NULL,
	"diagnosis" text NOT NULL,
	"diagnosis_confidence" double precision NOT NULL,
	"proposed_action" text,
	"proposed_action_reasoning" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_articles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "kb_chunks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "metric_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ticket_classifications" ADD CONSTRAINT "ticket_classifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_investigations" ADD CONSTRAINT "ticket_investigations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;